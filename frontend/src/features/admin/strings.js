// Every text shown on the admin pages. Kept here so an Arabic copy can be
// added later without touching the components.

export const TEXT = {
  directory: {
    title: "Participants",
    intro:
      "Every wallet with a saved profile, and the roles it holds on the blockchain right now.",
    register: "Register participant",
    refresh: "Refresh",
    search: "Search",
    searchHint: "Name, location or wallet address",
    loading: "Loading participants",
    empty: "No participants yet.",
    noMatch: "No participant matches this search.",
    noName: "No name saved",
    noRoles: "No roles",
    available: "Available",
    unavailable: "Unavailable",
    addRole: "Add a role",
    revoke: "Revoke a role",
    columns: {
      name: "Participant",
      location: "Location",
      roles: "Roles",
      availability: "Availability",
      actions: "Actions",
    },
  },

  form: {
    wallet: "Wallet address *",
    walletHint: "The participant's MetaMask address, starting with 0x.",
    badWallet: "Enter a wallet address: 0x followed by 40 letters or digits.",
    checking: "Reading the wallet's roles",
    known: "Registered as",
    unknown: "This wallet has no saved profile yet.",
    currentRoles: "Roles on the blockchain",
    noRoles: "None",
    role: "Role *",
    pickRole: "Pick a role.",
    choose: "Choose a role",
    hasRole: "already has it",
    alreadyHas: "This wallet already has this role.",
    working: "Working",
    toParticipants: "Back to participants",
  },

  register: {
    title: "Register a participant",
    intro:
      "Gives a wallet a role on the blockchain and saves its profile. You sign the transaction in MetaMask.",
    profile: "Profile",
    name: "Name *",
    nameHint: "Shown to other participants and on the public batch page.",
    needName: "Enter a name.",
    location: "Location",
    locationHint: "Town or city, also shown on the public batch page.",
    contactPhone: "Phone",
    email: "Email",
    badEmail: "Enter a valid email address.",
    postal: "Postal address",
    contactHint: "Only you and the participant can see these.",
    submit: "Register",
    doneTitle: "Participant registered",
    done: (name, role) =>
      `${name} now has the ${role} role on the blockchain, and the profile is saved.`,
    signIn:
      "They can sign in with this wallet now. If they are already signed in, they need to sign out and in again to see the new role.",
    another: "Register another",
  },

  revoke: {
    title: "Revoke a role",
    intro:
      "Removes a role from a wallet on the blockchain. The profile stays, so you can register the role again later.",
    nothing: "This wallet has no roles to revoke.",
    submit: "Revoke role",
    confirmTitle: "Are you sure?",
    confirm: (name, role) =>
      `${name} will lose the ${role} role. They will not be able to record steps as ${role} anymore. Steps they already recorded stay on the blockchain.`,
    confirmYes: "Yes, revoke the role",
    cancel: "Cancel",
    doneTitle: "Role revoked",
    done: (name, role) => `${name} no longer has the ${role} role.`,
    another: "Revoke another",
  },
};
