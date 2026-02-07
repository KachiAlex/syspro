# Team Permissions: Quick Reference Card

## 📋 Create a New Role - 3 Simple Steps

```
Step 1: Choose a Template (optional)
  ├─ Viewer: Read-only access to all areas
  ├─ Editor: View & Edit access to all areas (no Integrations)
  ├─ Manager: Full access except Integrations
  └─ Admin: Complete system access

Step 2: Name Your Role
  └─ Good names: "Sales Manager", "Finance Lead", "Junior Accountant"

Step 3: Set Permissions
  └─ For each area, choose: View | Edit | Manage
```

---

## 🔐 Permission Levels Explained

| Level | Can Do | Who Should Get It |
|-------|--------|-------------------|
| **View** | See & read only | Auditors, managers, read-only stakeholders |
| **Edit** | Create & modify | Daily users, team members |
| **Manage** | Full admin access | Department heads, system admins |

---

## 🏢 Business Areas

| Area | Controls |
|------|----------|
| **Sales & CRM** | Customers, leads, opportunities, deals |
| **Finance** | Invoices, budgets, reports, accounting |
| **People & HR** | Employees, attendance, payroll, org structure |
| **Projects** | Project plans, timelines, tasks, team assignments |
| **Billing** | Invoices, payments, billing records |
| **Integrations** | API keys, external connections, security settings |

---

## ✅ Good Practices

✅ **DO:**
- Start with a template
- Use clear, functional names
- Give only needed permissions
- Review roles quarterly
- Test new roles before mass rollout

❌ **DON'T:**
- Create unnecessary roles
- Use person names ("John's Role")
- Give admin access to everyone
- Forget to document decisions
- Delete roles without checking usage

---

## 🎯 Common Role Templates

### Sales Representative
- Sales & CRM: View + Edit
- Finance: View only
- Projects: View + Edit
- Billing: View only

### Finance Manager
- Finance: View + Edit + Manage
- Sales & CRM: View only
- People & HR: View only
- All others: None

### HR Administrator
- People & HR: View + Edit + Manage
- All others: None

### Department Manager
- All areas: View + Edit + Manage
- Integrations: View only

### System Administrator
- All areas: View + Edit + Manage
(All permissions enabled)

---

## 📊 Permission Matrix

```
Area          Viewer  Editor  Manager  Admin
───────────────────────────────────────────
Sales CRM      V      V+E     V+E+M    V+E+M
Finance        V      V+E     V+E+M    V+E+M
People         V      V+E     V+E+M    V+E+M
Projects       V      V+E     V+E+M    V+E+M
Billing        V      V+E     V+E+M    V+E+M
Integrations   -       -       -       V+E+M

V=View, E=Edit, M=Manage
```

---

## ❓ Troubleshooting Quick Answers

**Q: User can't see a feature**
A: Check if their role has "View" permission for that area

**Q: User needs to create records**
A: Upgrade their role to include "Edit" permission

**Q: Too many admins?**
A: Create granular roles, migrate users gradually

**Q: Making big permission change?**
A: Create new role v2, test it, migrate users, delete old role

---

## 🚀 Workflow: Add a New Team Member

1. Determine what they need to do
2. Find or create matching role
3. Test the role permissions
4. Assign role to their user account
5. Have them verify access
6. Document the decision

---

## 📞 Key Contacts

- **Need help?** See full guide at: `/docs/PEOPLE_AND_ACCESS_GUIDE.md`
- **Report issue:** Contact support
- **Need new role?** Discuss with team lead

---

## 💡 Quick Tips

- **Use templates** - Saves 80% of role creation time
- **Start minimal** - Give View first, add Edit/Manage later
- **Document it** - Keep simple notes on why each role exists
- **Review often** - Quarterly permission audits prevent problems
- **Test first** - Always test new roles before wide deployment

---

## 📅 Maintenance Checklist

Every Quarter:
- [ ] Review existing roles
- [ ] Check role usage
- [ ] Remove unused roles
- [ ] Update permissions as needed
- [ ] Document any changes

---

**Last Updated:** January 2025 | **Version:** 2.0 | **Status:** Ready to Use
