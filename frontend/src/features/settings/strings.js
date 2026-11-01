// Every text shown on the settings page. Kept here so an Arabic copy can be
// added later without touching the components.

export const TEXT = {
  title: "Settings",
  loading: "Loading your profile",
  noProfile:
    "This wallet has no profile yet. Ask the admin to register it, then come back here.",
  adminNoProfile:
    "The admin wallet has no participant profile, so there is nothing to edit here.",

  account: {
    title: "Your account",
    wallet: "Wallet",
    roles: "Roles",
    noRoles: "None",
  },

  availability: {
    title: "Availability",
    available: "Available",
    unavailable: "Unavailable",
    makeUnavailable: "Mark me as unavailable",
    makeAvailable: "Mark me as available",
    working: "Saving",
    transporter:
      "While you are unavailable you cannot claim new jobs. You can still see the job board and finish the jobs you already have.",
    facility:
      "While you are unavailable you are left out of destination lists, so nobody can send you a new batch. Batches already on the way to you still arrive, and you can confirm them.",
  },

  profile: {
    title: "Profile",
    intro: "Fields marked * are required.",
    name: "Name *",
    nameHint: "Shown to other participants and on the public batch page.",
    needName: "Enter a name.",
    location: "Location",
    locationHint: "Town or city, also shown on the public batch page.",
    contactPhone: "Phone",
    email: "Email",
    badEmail: "Enter a valid email address.",
    emailKept: "An email can be changed but not removed.",
    postal: "Postal address",
    contactHint: "Only you and the admin can see these.",
    details: "Business details",
    detailsFor: (role) => `Saved for your ${role} role.`,
    save: "Save changes",
    saving: "Saving",
    saved: "Your profile is saved.",
    nothing: "Nothing changed.",
  },
};
