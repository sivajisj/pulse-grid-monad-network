// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PulseGridEngine} from "../src/PulseGridEngine.sol";

contract PulseGridEngineTest is Test {
    PulseGridEngine public engine;

    address owner = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        engine = new PulseGridEngine();
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    // Needed so this contract (the owner) can accept the MON sent by withdraw()
    receive() external payable {}

    function test_CheckInUpdatesCellAndUser() public {
        vm.prank(alice);
        engine.executeCheckIn(1);

        (uint32 activeCheckIns, , ) = engine.gridCells(1);
        assertEq(activeCheckIns, 1);

        (uint32 cellId, , uint128 points) = engine.userStates(alice);
        assertEq(cellId, 1);
        assertEq(points, 100);
    }

    function test_CheckInAccumulatesPoints() public {
        vm.startPrank(alice);
        engine.executeCheckIn(1);
        vm.warp(block.timestamp + 31); // clear cooldown
        engine.executeCheckIn(2);
        vm.stopPrank();

        (, , uint128 points) = engine.userStates(alice);
        assertEq(points, 200);
    }

    function test_RevertWhen_CooldownActive() public {
        vm.startPrank(alice);
        engine.executeCheckIn(1);
        vm.expectRevert();
        engine.executeCheckIn(2);
        vm.stopPrank();
    }

    function test_CooldownClearsAfterWindow() public {
        vm.startPrank(alice);
        engine.executeCheckIn(1);
        vm.warp(block.timestamp + 30);
        engine.executeCheckIn(2); // should succeed at exactly the boundary
        vm.stopPrank();
    }

    function test_MicroTipIncreasesCellBalance() public {
        vm.prank(alice);
        engine.sendMicroTip{value: 1 ether}(5);

        (, uint64 totalTipsWei, ) = engine.gridCells(5);
        assertEq(totalTipsWei, 1 ether);
        assertEq(address(engine).balance, 1 ether);
    }

    function test_RevertWhen_ZeroValueTip() public {
        vm.prank(alice);
        vm.expectRevert();
        engine.sendMicroTip{value: 0}(5);
    }

    function test_GetCellStateBatch() public {
        vm.prank(alice);
        engine.executeCheckIn(1);
        vm.prank(bob);
        engine.executeCheckIn(2);

        uint256[] memory ids = new uint256[](2);
        ids[0] = 1;
        ids[1] = 2;

        PulseGridEngine.GridCell[] memory results = engine.getCellStateBatch(ids);
        assertEq(results[0].activeCheckIns, 1);
        assertEq(results[1].activeCheckIns, 1);
    }

    function test_OwnerCanWithdraw() public {
        vm.prank(alice);
        engine.sendMicroTip{value: 2 ether}(1);

        uint256 balBefore = owner.balance;
        engine.withdraw(payable(owner));
        assertEq(owner.balance, balBefore + 2 ether);
        assertEq(address(engine).balance, 0);
    }

    function test_RevertWhen_NonOwnerWithdraws() public {
        vm.prank(alice);
        vm.expectRevert();
        engine.withdraw(payable(alice));
    }

    function test_RevertWhen_WithdrawWithNoBalance() public {
        vm.expectRevert();
        engine.withdraw(payable(owner));
    }

    function testFuzz_CheckInDifferentCells(uint256 cellId) public {
        vm.prank(alice);
        engine.executeCheckIn(cellId);
        (uint32 activeCheckIns, , ) = engine.gridCells(cellId);
        assertEq(activeCheckIns, 1);
    }
}