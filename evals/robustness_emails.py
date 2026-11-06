"""Separate paraphrases for checking generalization after tuning on the golden set."""

from evals.golden_emails import email


ROBUSTNESS_EMAILS = [
    {
        "name": "replacement-kit-shipping-fee",
        "email": email("Morgan <morgan@example.com>", "Replacement hardware postage",
                       "Is there a delivery charge when a replacement hardware kit for my bookcase is sent?"),
        "section": "shipping", "action": "reply",
    },
    {
        "name": "catalog-assembly-advice",
        "email": email("Morgan <morgan@example.com>", "HP-C4 assembly",
                       "While building my HP-C4, should the finished face of the back panel point inward?"),
        "section": "shelving", "action": "reply",
    },
    {
        "name": "catalog-family-different-model",
        "email": email("Drew <drew@example.com>", "The color is different",
                       "I ordered the HP-C9 in black but received natural oak. "
                       "Order 114-7200180-6620034."),
        "section": "shelving", "action": "escalate",
    },
    {
        "name": "return-instructions-another-product",
        "email": email("Robin <robin@example.com>", "Amazon return procedure",
                       "Could you explain the steps for returning a garden cushion I bought from you?"),
        "section": "returns-and-warranty", "action": "reply",
    },
    {
        "name": "refund-is-a-transaction",
        "email": email("Robin <robin@example.com>", "Please refund the purchase",
                       "Please issue a refund for the bookcase I bought. I do not want an exchange."),
        "section": "returns-and-warranty", "action": "escalate",
    },
    {
        "name": "missing-fin-reference-supplied",
        "email": email("Alex <alex@example.com>", "Accessory absent",
                       "The removable fin was absent from my paddle board package. "
                       "My purchase reference is 114-8200190-2210043."),
        "section": "paddle-boards", "action": "escalate",
    },
    {
        "name": "missing-bolts-reference-absent",
        "email": email("Alex <alex@example.com>", "Bookcase assembly kit",
                       "I am assembling my Harbor & Pine bookcase but the bolts are missing. What should I do?"),
        "section": "shelving", "action": "reply",
    },
    {
        "name": "published-spare-part-transit-policy",
        "email": email("Casey <casey@example.com>", "Usual delivery window",
                       "What is the usual dispatch and delivery window for spare shelf parts? "
                       "I am asking about your policy, not tracking an existing parcel."),
        "section": "shipping", "action": "reply",
    },
    {
        "name": "specific-delivery-investigation",
        "email": email("Casey <casey@example.com>", "Please locate my parcel",
                       "Please investigate where order 114-3300120-4550067 is. "
                       "The promised delivery date was three days ago."),
        "section": "shipping", "action": "escalate",
    },
]
