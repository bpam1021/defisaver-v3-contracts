// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

import "../core/DFSRegistry.sol";

abstract contract ActionBase {
    address public constant REGISTRY_ADDR = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
    DFSRegistry public constant registry = DFSRegistry(REGISTRY_ADDR);

    DefisaverLogger public constant logger = DefisaverLogger(
        0x5c55B921f590a89C1Ebe84dF170E655a82b62126
    );

    enum ActionType {FL_ACTION, STANDARD_ACTION, CUSTOM_ACTION}

    function executeAction(
        uint256,
        bytes memory,
        bytes32[] memory
    ) public payable virtual returns (bytes32);

    function actionType() public pure virtual returns (uint8);
}