# Fairpay — PayPal sandbox evidence

All on the PayPal **sandbox**, app `APP-0ES33723YR248581P`.

Escrow "Bakery Logo Design" ($300, 2 milestones):

| Step | PayPal object |
|---|---|
| Client approved, budget held (Orders v2, intent AUTHORIZE) | authorization ending `2946` |
| Milestone 1 — referee: partial 50% → $60 captured | capture `01T24658G9557871Y` |
| Milestone 1 — $60 paid to the freelancer (Payouts) | batch `CLL9J64YJLWQG` |
| Milestone 2 — referee: release 100% → agent paused → human approved → $180 captured | capture `5PX53705R6223022N` |
| Milestone 2 — $180 paid out (Payouts) | batch `8DKLDW2T2ENH2` |
| Escrow settled — unreleased $60 voided back to the client | authorization void |

Live demo: http://187.126.26.84:8790 · Code: https://github.com/notaaaronfr/Fairpay
