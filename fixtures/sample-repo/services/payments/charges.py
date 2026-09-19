from decimal import Decimal


def create_charge(db, gateway, customer_id: str, amount: Decimal, currency: str) -> str:
    charge = gateway.charge(customer=customer_id, amount=amount, currency=currency)
    db.charges.insert(id=charge.id, customer_id=customer_id, amount=amount, currency=currency)
    return charge.id


def refund_charge(db, gateway, charge_id: str, amount: Decimal) -> str:
    charge = db.charges.get(id=charge_id)
    refund = gateway.refund(charge=charge.id, amount=amount)
    db.refunds.insert(id=refund.id, charge_id=charge_id, amount=amount)
    return refund.id
