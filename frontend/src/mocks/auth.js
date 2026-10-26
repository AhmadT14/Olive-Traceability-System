// Mock roles follow the default Anvil accounts 1 to 7. Account 0 is the admin.
const MOCK_ROLES = {
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8": ["FARMER"],
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc": ["MILL"],
  "0x90f79bf6eb2c4f870365e785982e1f101e93b906": ["TRANSPORTER"],
  "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65": ["STORAGE"],
  "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc": ["EXPORTER"],
  "0x976ea74026e726554db657fa54763abd0c3a0aa9": ["IMPORTER"],
  "0x14dc79964da2c08b23698b3d3cc7ca32193d9955": ["RETAILER"],
};

export function nonceMock(address) {
  const nonce = `mock-${Date.now()}`;
  return {
    address,
    nonce,
    message: `Sign in to Olive Traceability. Nonce: ${nonce}`,
  };
}

export function loginMock(address) {
  return {
    address,
    roles: MOCK_ROLES[address.toLowerCase()] || [],
    token: "mock-token",
  };
}
