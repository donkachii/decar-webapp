from app.seed import Seed, check_seed, load_seed


def test_seed_follows_the_domain_rules() -> None:
    seed = load_seed()
    assert check_seed(seed) == []
    assert (len(seed.vehicles), len(seed.parts), len(seed.fitment)) == (10, 36, 38)


def test_check_catches_broken_rules() -> None:
    seed = load_seed()
    grade_b = next(p for p in seed.parts if p.condition == "belgium-b")
    broken = Seed(
        vehicles=seed.vehicles,
        parts=[
            *[p for p in seed.parts if p is not grade_b],
            grade_b.model_copy(update={"defects": [], "stock_qty": 2}),
        ],
        fitment=[*seed.fitment, seed.fitment[0]],
    )
    errors = check_seed(broken)
    assert f"{grade_b.sku}: grade B and C units must list defects" in errors
    assert f"{grade_b.sku}: Belgium units are one-offs (stockQty ≤ 1)" in errors
    assert any("duplicate row" in e for e in errors)
