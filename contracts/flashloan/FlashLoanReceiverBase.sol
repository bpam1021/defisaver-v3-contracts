// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

import "../utils/SafeERC20.sol";

interface IFlashLoanReceiver {
    function executeOperation(
        address _reserve,
        uint256 _amount,
        uint256 _fee,
        bytes calldata _params
    ) external;
}

abstract contract ILendingPoolAddressesProvider {
    function getLendingPool() public view virtual returns (address);

    function setLendingPoolImpl(address _pool) public virtual;

    function getLendingPoolCore() public view virtual returns (address payable);

    function setLendingPoolCoreImpl(address _lendingPoolCore) public virtual;

    function getLendingPoolConfigurator() public view virtual returns (address);

    function setLendingPoolConfiguratorImpl(address _configurator) public virtual;

    function getLendingPoolDataProvider() public view virtual returns (address);

    function setLendingPoolDataProviderImpl(address _provider) public virtual;

    function getLendingPoolParametersProvider() public view virtual returns (address);

    function setLendingPoolParametersProviderImpl(address _parametersProvider) public virtual;

    function getTokenDistributor() public view virtual returns (address);

    function setTokenDistributor(address _tokenDistributor) public virtual;

    function getFeeProvider() public view virtual returns (address);

    function setFeeProviderImpl(address _feeProvider) public virtual;

    function getLendingPoolLiquidationManager() public view virtual returns (address);

    function setLendingPoolLiquidationManager(address _manager) public virtual;

    function getLendingPoolManager() public view virtual returns (address);

    function setLendingPoolManager(address _lendingPoolManager) public virtual;

    function getPriceOracle() public view virtual returns (address);

    function setPriceOracle(address _priceOracle) public virtual;

    function getLendingRateOracle() public view virtual returns (address);

    function setLendingRateOracle(address _lendingRateOracle) public virtual;
}

library EthAddressLib {
    function ethAddress() internal pure returns (address) {
        return 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    }
}

abstract contract FlashLoanReceiverBase is IFlashLoanReceiver {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    ILendingPoolAddressesProvider public addressesProvider;

    constructor(ILendingPoolAddressesProvider _provider) {
        addressesProvider = _provider;
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external virtual payable {}

    function transferFundsBackToPoolInternal(address _reserve, uint256 _amount) internal {
        address payable core = addressesProvider.getLendingPoolCore();

        transferInternal(core, _reserve, _amount);
    }

    function transferInternal(
        address payable _destination,
        address _reserve,
        uint256 _amount
    ) internal {
        if (_reserve == EthAddressLib.ethAddress()) {
            _destination.call{value: _amount}(""); // solhint-disable-line
            return;
        }

        IERC20(_reserve).safeTransfer(_destination, _amount);
    }

    function getBalanceInternal(address _target, address _reserve) internal view returns (uint256) {
        if (_reserve == EthAddressLib.ethAddress()) {
            return _target.balance;
        }

        return IERC20(_reserve).balanceOf(_target);
    }
}