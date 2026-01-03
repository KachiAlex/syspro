"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactType = exports.SubscriptionStatus = void 0;
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["ACTIVE"] = "active";
    SubscriptionStatus["CANCELED"] = "canceled";
    SubscriptionStatus["PAST_DUE"] = "past_due";
    SubscriptionStatus["UNPAID"] = "unpaid";
    SubscriptionStatus["TRIALING"] = "trialing";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
var ContactType;
(function (ContactType) {
    ContactType["CUSTOMER"] = "customer";
    ContactType["VENDOR"] = "vendor";
    ContactType["EMPLOYEE"] = "employee";
    ContactType["LEAD"] = "lead";
})(ContactType || (exports.ContactType = ContactType = {}));
//# sourceMappingURL=index.js.map