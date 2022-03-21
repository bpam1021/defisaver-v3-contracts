// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

import "./MainnetAaveV3Addresses.sol";

import "../../../interfaces/aaveV3/IL2PoolV3.sol";
import "../../../interfaces/aaveV3/IAaveProtocolDataProvider.sol";
import "../../../interfaces/aaveV3/IPoolAddressesProvider.sol";

/// @title Utility functions and data used in AaveV3 actions
contract AaveV3Helper is MainnetAaveV3Addresses {
    /// TODO: Change this later
    uint16 public constant AAVE_REFERRAL_CODE = 64;

    uint256 public constant STABLE_ID = 1;
    uint256 public constant VARIABLE_ID = 2;
    
    /// @notice Returns the lending pool contract of the specified market
    function getLendingPool(address _market) internal view returns (IL2PoolV3) {
        return IL2PoolV3(IPoolAddressesProvider(_market).getPool());
    }

    /// @notice Fetch the data provider for the specified market
    function getDataProvider(address _market) internal view returns (IAaveProtocolDataProvider) {
        return
            IAaveProtocolDataProvider(
                IPoolAddressesProvider(_market).getPoolDataProvider()
            );
    }

    function boolToBytes(bool x) internal pure returns (bytes1 r) {
       if (x) {
           r = bytes1(uint8(1));
       } else {
           r = bytes1(uint8(0));
       }
    }

    function bytesToBool(bytes1 x) internal pure returns (bool r) {
        if (uint8(x) == 0) {
            return false;
        }
        return true;
    }
}