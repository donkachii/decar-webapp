import { Router } from "express";

import { currentUser } from "../auth.js";
import type { Settings } from "../config.js";
import { prisma } from "../db.js";
import { MAKES, oneOf } from "../domain/catalog.js";
import { isCheckoutErrors, validateCheckout } from "../domain/checkout.js";
import { vehicleLabel } from "../domain/labels.js";
import { HttpError, parse, pathUuid } from "../http.js";
import { CheckoutIn, orderOut, PaystackVerifyIn, publicOrder } from "../schemas.js";
import { sendOrderEmails } from "../services/email.js";
import { getOrder, placeOrder } from "../services/orders.js";
import { confirmPayment, startPayment } from "../services/paystack.js";

export function ordersRouter(settings: Settings): Router {
  const router = Router();

  /** Guest checkout always works; a session token only links the order to the account. */
  router.post("/orders", async (req, res) => {
    const user = await currentUser(req, settings);
    const body = parse(CheckoutIn, req.body, "body");
    const checkout = validateCheckout(body, { paystackEnabled: settings.paystackEnabled });
    if (isCheckoutErrors(checkout)) {
      const fieldErrors = Object.keys(checkout.fieldErrors).length > 0 ? checkout.fieldErrors : undefined;
      res.status(422).json({ message: checkout.message, ...(fieldErrors ? { fieldErrors } : {}) });
      return;
    }

    const result = await placeOrder(checkout, user?.id ?? null);
    if ("unavailable" in result) {
      res.status(409).json({
        message: "Some parts sold or were reserved while you were checking out. Remove them and try again.",
        unavailable: result.unavailable,
      });
      return;
    }

    const paymentUrl = result.paymentMethod === "paystack" ? await startPayment(settings, result) : null;
    const order = orderOut(result);
    const vehicle = order.vehicleId ? await prisma.vehicle.findUnique({ where: { id: order.vehicleId } }) : null;
    const label = vehicle ? vehicleLabel(oneOf(MAKES, vehicle.make), vehicle.model, vehicle.yearFrom, vehicle.yearTo) : null;
    res.status(201).json({ order, paymentUrl });
    // After the response, so email never slows or fails an order. Never throws.
    void sendOrderEmails(settings, order, label);
  });

  /** The order page. Anyone with the link sees it, so contact details are masked. */
  router.get("/orders/:orderId", async (req, res) => {
    const order = await getOrder(pathUuid(req, "orderId"));
    if (order === null) throw new HttpError(404, "No such order.");
    res.json(publicOrder(orderOut(order)));
  });

  /** The order page's "Pay now" button, for a Paystack payment that didn't finish. */
  router.post("/orders/:orderId/payment", async (req, res) => {
    const order = await getOrder(pathUuid(req, "orderId"));
    if (
      order === null ||
      order.paymentMethod !== "paystack" ||
      order.paymentStatus === "paid" ||
      order.status !== "new"
    ) {
      throw new HttpError(409, "This order has nothing to pay.");
    }
    res.json({ paymentUrl: await startPayment(settings, order) });
  });

  /** Called when Paystack sends the buyer back. Checks the amount before marking the order paid. */
  router.post("/payments/paystack/verify", async (req, res) => {
    const { reference } = parse(PaystackVerifyIn, req.body, "body");
    const result = await confirmPayment(settings, reference);
    if (result === null) throw new HttpError(404, "Unknown payment reference.");
    res.json({ orderId: result.id, paid: result.paid });
  });

  return router;
}
