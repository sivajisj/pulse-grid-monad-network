// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PulseGridEngine} from "../src/PulseGridEngine.sol";

contract DeployScript is Script {
    function run() external returns (PulseGridEngine) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        PulseGridEngine engine = new PulseGridEngine();
        vm.stopBroadcast();

        console.log("PulseGridEngine deployed at:", address(engine));
        return engine;
    }
}