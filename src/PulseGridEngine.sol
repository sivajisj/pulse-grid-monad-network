// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PulseGridEngine
 * @notice Event check-in and micro-tipping engine. Each cell/user write hits an
 *         independent storage slot, so Monad's parallel-execution engine can
 *         schedule many of these concurrently instead of serializing them.
 */
contract PulseGridEngine {
    address public immutable owner;

    struct GridCell {
        uint32 activeCheckIns;
        uint64 totalTipsWei;
        uint32 lastUpdatedBlock;
    }

    struct UserState {
        uint32 currentCellId;
        uint64 timestamp;
        uint128 totalPoints;
    }

    uint256 public constant CHECKIN_COOLDOWN = 30; // seconds between check-ins per user

    mapping(uint256 => GridCell) public gridCells;   // cellId => cell state
    mapping(address => UserState) public userStates; // user => profile
    mapping(address => uint256) public lastCheckInAt; // user => unix timestamp

    event CheckInExecuted(address indexed user, uint256 indexed cellId, uint256 timestamp);
    event MicroTipSent(address indexed sender, uint256 indexed cellId, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    error NotOwner();
    error CooldownActive(uint256 secondsRemaining);
    error InvalidTip();
    error NoBalance();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Parallel check-in entrypoint. One call = isolated write to
    ///         gridCells[cellId] and userStates[msg.sender].
    function executeCheckIn(uint256 cellId) external {
        uint256 last = lastCheckInAt[msg.sender];
        if (last != 0 && block.timestamp < last + CHECKIN_COOLDOWN) {
            revert CooldownActive(last + CHECKIN_COOLDOWN - block.timestamp);
        }

        gridCells[cellId].activeCheckIns += 1;
        gridCells[cellId].lastUpdatedBlock = uint32(block.number);

        userStates[msg.sender] = UserState({
            currentCellId: uint32(cellId),
            timestamp: uint64(block.timestamp),
            totalPoints: userStates[msg.sender].totalPoints + 100
        });

        lastCheckInAt[msg.sender] = block.timestamp;

        emit CheckInExecuted(msg.sender, cellId, block.timestamp);
    }

    /// @notice Micro-tip a cell. Funds accumulate in the contract until owner withdraws.
    function sendMicroTip(uint256 cellId) external payable {
        if (msg.value == 0) revert InvalidTip();
        gridCells[cellId].totalTipsWei += uint64(msg.value);
        emit MicroTipSent(msg.sender, cellId, msg.value);
    }

    /// @notice Batch reader for the frontend WebGL map — one RPC call for N cells.
    function getCellStateBatch(uint256[] calldata cellIds)
        external
        view
        returns (GridCell[] memory results)
    {
        results = new GridCell[](cellIds.length);
        for (uint256 i = 0; i < cellIds.length; i++) {
            results[i] = gridCells[cellIds[i]];
        }
    }

    /// @notice Owner-only withdraw of accumulated tips.
    function withdraw(address payable to) external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoBalance();
        (bool ok, ) = to.call{value: balance}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(to, balance);
    }

    receive() external payable {}
}