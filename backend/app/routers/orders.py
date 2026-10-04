import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from fastapi.responses import JSONResponse

from app.auth import CurrentUser, SettingsDep
from app.db import SessionDep
from app.domain.checkout import CheckoutErrors, validate_checkout
from app.domain.labels import vehicle_label
from app.models import Vehicle
from app.schemas import (
    CheckoutErrorOut,
    CheckoutIn,
    CheckoutOut,
    OrderOut,
    PaymentStartOut,
    PaystackVerifyIn,
    PaystackVerifyOut,
)
from app.services import orders, paystack
from app.services.email import send_order_emails

router = APIRouter(tags=["orders"])


def _error(status_code: int, body: CheckoutErrorOut) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=body.model_dump(by_alias=True, exclude_none=True))


@router.post(
    "/orders",
    status_code=status.HTTP_201_CREATED,
    response_model=CheckoutOut,
    responses={
        409: {"model": CheckoutErrorOut, "description": "Some units sold or were reserved meanwhile"},
        422: {"model": CheckoutErrorOut, "description": "Form errors, keyed by field"},
    },
)
async def place_order(
    body: CheckoutIn,
    session: SessionDep,
    settings: SettingsDep,
    user: CurrentUser,
    background: BackgroundTasks,
) -> CheckoutOut | JSONResponse:
    """Guest checkout always works; a session token only links the order to the account."""
    checkout = validate_checkout(body, paystack_enabled=settings.paystack_enabled)
    if isinstance(checkout, CheckoutErrors):
        return _error(
            422, CheckoutErrorOut(message=checkout.message, field_errors=checkout.field_errors or None)
        )

    result = await orders.place_order(session, checkout, user.id if user else None)
    if isinstance(result, orders.Unavailable):
        return _error(
            409,
            CheckoutErrorOut(
                message=(
                    "Some parts sold or were reserved while you were checking out. Remove them and try again."
                ),
                unavailable=result.skus,
            ),
        )

    payment_url = (
        await paystack.start_payment(session, settings, result)
        if result.payment_method == "paystack"
        else None
    )
    order = OrderOut.model_validate(result)
    vehicle = await session.get(Vehicle, order.vehicle_id) if order.vehicle_id else None
    label = (
        vehicle_label(vehicle.make, vehicle.model, vehicle.year_from, vehicle.year_to) if vehicle else None
    )
    background.add_task(send_order_emails, settings, order, label)
    return CheckoutOut(order=order, payment_url=payment_url)


@router.get("/orders/{order_id}", responses={404: {"description": "No such order"}})
async def get_order(order_id: uuid.UUID, session: SessionDep) -> OrderOut:
    """The order page. Anyone with the link sees it, so contact details are masked."""
    order = await orders.get_order(session, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such order.")
    return OrderOut.model_validate(order).public()


@router.post("/orders/{order_id}/payment", responses={409: {"description": "Nothing to pay"}})
async def retry_payment(order_id: uuid.UUID, session: SessionDep, settings: SettingsDep) -> PaymentStartOut:
    """The order page's "Pay now" button, for a Paystack payment that didn't finish."""
    order = await orders.get_order(session, order_id)
    if (
        order is None
        or order.payment_method != "paystack"
        or order.payment_status == "paid"
        or order.status != "new"
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, "This order has nothing to pay.")
    return PaymentStartOut(payment_url=await paystack.start_payment(session, settings, order))


@router.post("/payments/paystack/verify", responses={404: {"description": "Unknown reference"}})
async def verify_paystack(
    body: PaystackVerifyIn, session: SessionDep, settings: SettingsDep
) -> PaystackVerifyOut:
    """Called when Paystack sends the buyer back. Checks the amount before marking the order paid."""
    order = await paystack.confirm_payment(session, settings, body.reference)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown payment reference.")
    return PaystackVerifyOut(order_id=order.id, paid=order.payment_status == "paid")
