export const CONTRACT_ADDRESS =
  "0x481D3c0C2F173Ed5BD31cf27986884d8b304905A" as const;

export const PULSEGRID_ABI = [
  {
    type: "function",
    name: "executeCheckIn",
    inputs: [{ name: "cellId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "sendMicroTip",
    inputs: [{ name: "cellId", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "gridCells",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "activeCheckIns", type: "uint32" },
      { name: "totalTipsWei", type: "uint64" },
      { name: "lastUpdatedBlock", type: "uint32" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCellStateBatch",
    inputs: [{ name: "cellIds", type: "uint256[]" }],
    outputs: [
      {
        name: "results",
        type: "tuple[]",
        components: [
          { name: "activeCheckIns", type: "uint32" },
          { name: "totalTipsWei", type: "uint64" },
          { name: "lastUpdatedBlock", type: "uint32" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "CheckInExecuted",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "cellId", type: "uint256", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "MicroTipSent",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "cellId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
