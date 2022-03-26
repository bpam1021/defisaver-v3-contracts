const { expect } = require('chai');
const hre = require('hardhat');

const dfs = require('@defisaver/sdk');

const ISubscriptionsABI = require('../../artifacts/contracts/interfaces/ISubscriptions.sol/ISubscriptions.json').abi;
const {
    getAddrFromRegistry,
    getProxy,
    redeploy,
    balanceOf,
    formatExchangeObj,
    WETH_ADDRESS,
    setNewExchangeWrapper,
    sendEther,
    ETH_ADDR,
    depositToWeth,
    send,
    approve,
    stopImpersonatingAccount,
    DFS_REG_CONTROLLER,
    ADMIN_ACC,
    impersonateAccount,
    setBalance,
    resetForkToBlock,
} = require('../utils');

const { fetchMakerAddresses } = require('../utils-mcd');
const { changeProxyOwner, automationV2Unsub, executeAction } = require('../actions');

const wrapEthTest = async () => {
    describe('Wrap-Eth', function () {
        this.timeout(80000);

        let makerAddresses; let senderAcc; let proxy; let
            uniWrapperAddr;
        let recipeExecutorAddr;

        before(async () => {
            uniWrapperAddr = await getAddrFromRegistry('UniswapWrapperV3');

            makerAddresses = await fetchMakerAddresses();
            recipeExecutorAddr = await getAddrFromRegistry('RecipeExecutor');

            // eslint-disable-next-line prefer-destructuring
            senderAcc = (await hre.ethers.getSigners())[0];
            proxy = await getProxy(senderAcc.address);

            await setNewExchangeWrapper(senderAcc, uniWrapperAddr);
        });
        it('... should wrap native Eth to Weth direct action', async () => {
            const amount = hre.ethers.utils.parseUnits('2', 18);
            const wrapEthAddr = await getAddrFromRegistry('WrapEth');
            const wrapEthAction = new dfs.actions.basic.WrapEthAction(amount);
            const functionData = wrapEthAction.encodeForDsProxyCall()[1];

            const wethBalanceBefore = await balanceOf(WETH_ADDRESS, proxy.address);
            console.log(`Weth proxy before: ${wethBalanceBefore / 1e18}`);

            await proxy['execute(address,bytes)'](wrapEthAddr, functionData, {
                value: amount,
                gasLimit: 3000000,
            });
            const wethBalanceAfter = await balanceOf(WETH_ADDRESS, proxy.address);
            console.log(`Weth proxy after: ${wethBalanceAfter / 1e18}`);

            expect(wethBalanceAfter / 1e18).to.be.eq(wethBalanceBefore / 1e18 + amount / 1e18);
        });

        it('... should do a market sell but first wrap eth -> weth', async () => {
            const amount = hre.ethers.utils.parseUnits('2', 18);

            const exchangeOrder = formatExchangeObj(
                WETH_ADDRESS,
                makerAddresses.MCD_DAI,
                amount,
                uniWrapperAddr,
            );

            const wrapRecipe = new dfs.Recipe('WrapRecipe', [
                new dfs.actions.basic.WrapEthAction(amount),
                new dfs.actions.basic.SellAction(exchangeOrder, proxy.address, senderAcc.address),
            ]);

            const functionData = wrapRecipe.encodeForDsProxyCall();

            const daiBalanceBefore = await balanceOf(makerAddresses.MCD_DAI, senderAcc.address);
            console.log(`Dai acc before: ${daiBalanceBefore / 1e18}`);
            await proxy['execute(address,bytes)'](recipeExecutorAddr, functionData[1], {
                gasLimit: 3000000,
                value: amount,
            });

            const daiBalanceAfter = await balanceOf(makerAddresses.MCD_DAI, senderAcc.address);
            console.log(`Dai acc after: ${daiBalanceAfter / 1e18}`);

            expect(daiBalanceAfter).to.be.gt(daiBalanceBefore);
        });
    });
};
const unwrapEthTest = async () => {
    describe('Unwrap-Eth', function () {
        this.timeout(80000);

        let senderAcc; let proxy;

        before(async () => {
            senderAcc = (await hre.ethers.getSigners())[0];
            proxy = await getProxy(senderAcc.address);
        });
        it('... should unwrap native WEth to Eth direct action', async () => {
            const amount = hre.ethers.utils.parseUnits('2', 18);
            await depositToWeth(amount);

            await send(WETH_ADDRESS, proxy.address, amount);

            const unwrapEthAction = new dfs.actions.basic.UnwrapEthAction(
                amount, senderAcc.address,
            );
            const functionData = unwrapEthAction.encodeForDsProxyCall()[1];

            const ethBalanceBefore = await balanceOf(ETH_ADDR, senderAcc.address);
            console.log(`Eth proxy before: ${ethBalanceBefore / 1e18}`);

            await executeAction('UnwrapEth', functionData, proxy);

            const ethBalanceAfter = await balanceOf(ETH_ADDR, senderAcc.address);
            console.log(`Eth proxy after: ${ethBalanceAfter / 1e18}`);

            expect(ethBalanceAfter / 1e18).to.be.gt(ethBalanceBefore / 1e18);
        });

        it('... should unwrap weth -> eth in a recipe', async () => {
            const amount = hre.ethers.utils.parseUnits('2', 18);

            await sendEther(senderAcc, proxy.address, '2');

            const unwrapRecipe = new dfs.Recipe('UnwrapRecipe', [
                new dfs.actions.basic.WrapEthAction(amount),
                new dfs.actions.basic.UnwrapEthAction(amount, senderAcc.address),
            ]);

            const functionData = unwrapRecipe.encodeForDsProxyCall();

            const ethBalanceBefore = await balanceOf(ETH_ADDR, senderAcc.address);
            console.log(`Eth proxy before: ${ethBalanceBefore / 1e18}`);

            await executeAction('RecipeExecutor', functionData[1], proxy);

            const ethBalanceAfter = await balanceOf(ETH_ADDR, senderAcc.address);
            console.log(`Eth proxy after: ${ethBalanceAfter / 1e18}`);

            expect(ethBalanceAfter / 1e18).to.be.gt(ethBalanceBefore / 1e18);
        });
    });
};
const sumInputsTest = async () => {
    describe('Sum-Inputs', function () {
        this.timeout(80000);

        let recipeExecutorAddr; let senderAcc; let proxy;

        before(async () => {
            recipeExecutorAddr = await getAddrFromRegistry('RecipeExecutor');
            senderAcc = (await hre.ethers.getSigners())[0];
            proxy = await getProxy(senderAcc.address);
        });

        it('... should sum two inputs in a recipe', async () => {
            await setBalance(WETH_ADDRESS, proxy.address, hre.ethers.utils.parseUnits('0', 18));
            await depositToWeth(hre.ethers.utils.parseUnits('10', 18));
            await approve(WETH_ADDRESS, proxy.address);

            const a = hre.ethers.utils.parseUnits('2', 18);
            const b = hre.ethers.utils.parseUnits('7', 18);
            const testSumInputs = new dfs.Recipe('TestSumInputs', [
                new dfs.actions.basic.SumInputsAction(a, b),
                new dfs.actions.basic.PullTokenAction(WETH_ADDRESS, senderAcc.address, '$1'),
            ]);
            const functionData = testSumInputs.encodeForDsProxyCall()[1];

            await executeAction('RecipeExecutor', functionData, proxy);

            expect(await balanceOf(WETH_ADDRESS, proxy.address)).to.be.eq(hre.ethers.utils.parseUnits('9', 18));
        });

        it('... should revert in event of overflow', async () => {
            await depositToWeth(hre.ethers.utils.parseUnits('10', 18));
            await approve(WETH_ADDRESS, proxy.address);

            const a = hre.ethers.utils.parseUnits('1', 18);
            const b = hre.ethers.constants.MaxUint256;
            const testSumInputs = new dfs.Recipe('TestSumInputs', [
                new dfs.actions.basic.SumInputsAction(a, b),
                new dfs.actions.basic.PullTokenAction(WETH_ADDRESS, senderAcc.address, '$1'),
            ]);
            const functionData = testSumInputs.encodeForDsProxyCall()[1];

            await expect(proxy['execute(address,bytes)'](recipeExecutorAddr, functionData)).to.be.reverted;
        });
    });
};
const subInputsTest = async () => {
    describe('Sub-Inputs', function () {
        this.timeout(80000);

        let recipeExecutorAddr; let senderAcc; let proxy;

        before(async () => {
            recipeExecutorAddr = await getAddrFromRegistry('RecipeExecutor');
            senderAcc = (await hre.ethers.getSigners())[0];
            proxy = await getProxy(senderAcc.address);
        });

        it('... should sub two inputs in a recipe', async () => {
            await setBalance(WETH_ADDRESS, proxy.address, hre.ethers.utils.parseUnits('0', 18));
            await depositToWeth(hre.ethers.utils.parseUnits('10', 18));
            await approve(WETH_ADDRESS, proxy.address);

            const a = hre.ethers.utils.parseUnits('9', 18);
            const b = hre.ethers.utils.parseUnits('2', 18);
            const testSubInputs = new dfs.Recipe('TestSubInputs', [
                new dfs.actions.basic.SubInputsAction(a, b),
                new dfs.actions.basic.PullTokenAction(WETH_ADDRESS, senderAcc.address, '$1'),
            ]);
            const functionData = testSubInputs.encodeForDsProxyCall()[1];

            await executeAction('RecipeExecutor', functionData, proxy);

            expect(await balanceOf(WETH_ADDRESS, proxy.address)).to.be.eq(hre.ethers.utils.parseUnits('7', 18));
        });

        it('... should revert in event of underflow', async () => {
            await depositToWeth(hre.ethers.utils.parseUnits('10', 18));
            await approve(WETH_ADDRESS, proxy.address);

            const a = hre.ethers.utils.parseUnits('1', 18);
            const b = hre.ethers.utils.parseUnits('5', 18);
            const testSubInputs = new dfs.Recipe('TestSubInputs', [
                new dfs.actions.basic.SubInputsAction(a, b),
                new dfs.actions.basic.PullTokenAction(WETH_ADDRESS, senderAcc.address, '$1'),
            ]);
            const functionData = testSubInputs.encodeForDsProxyCall()[1];

            await expect(proxy['execute(address,bytes)'](recipeExecutorAddr, functionData)).to.be.reverted;
        });
    });
};

const sendTokenTest = async () => {
    describe('Send-Token', function () {
        this.timeout(80000);

        let senderAcc; let proxy;

        before(async () => {
            senderAcc = (await hre.ethers.getSigners())[0];
            proxy = await getProxy(senderAcc.address);
        });
        it('... should send tokens direct action', async () => {
            const wrapEthAddr = await getAddrFromRegistry('WrapEth');
            const wrapEthAction = new dfs.actions.basic.WrapEthAction(hre.ethers.utils.parseUnits('4', 18));
            const functionData = wrapEthAction.encodeForDsProxyCall()[1];

            // clean any WETH balance from earlier tests
            await setBalance(WETH_ADDRESS, proxy.address, hre.ethers.utils.parseUnits('0', 18));
            await setBalance(WETH_ADDRESS, senderAcc.address, hre.ethers.utils.parseUnits('0', 18));

            await proxy['execute(address,bytes)'](wrapEthAddr, functionData, {
                value: hre.ethers.utils.parseUnits('4', 18),
                gasLimit: 3000000,
            });
            const sendTokenAction = new dfs.actions.basic.SendTokenAction(
                WETH_ADDRESS, senderAcc.address, hre.ethers.utils.parseUnits('3', 18),
            );
            const sendTokenData = sendTokenAction.encodeForDsProxyCall()[1];

            await executeAction('SendToken', sendTokenData, proxy);
            expect(await balanceOf(WETH_ADDRESS, senderAcc.address)).to.be.eq(hre.ethers.utils.parseUnits('3', 18));
        });

        it('... should send tokens direct action uint256.max', async () => {
            const sendTokenAction = new dfs.actions.basic.SendTokenAction(
                WETH_ADDRESS, senderAcc.address, hre.ethers.constants.MaxUint256,
            );
            const sendTokenData = sendTokenAction.encodeForDsProxyCall()[1];

            await executeAction('SendToken', sendTokenData, proxy);
            expect(await balanceOf(WETH_ADDRESS, senderAcc.address)).to.be.eq(hre.ethers.utils.parseUnits('4', 18));
        });
    });
};
const pullTokenTest = async () => {
    describe('Pull-Token', function () {
        this.timeout(80000);

        let senderAcc; let proxy;

        before(async () => {
            senderAcc = (await hre.ethers.getSigners())[0];
            proxy = await getProxy(senderAcc.address);
        });

        it('... should pull tokens direct action', async () => {
            // clean any WETH balance from earlier tests
            await setBalance(WETH_ADDRESS, proxy.address, hre.ethers.utils.parseUnits('0', 18));
            await setBalance(WETH_ADDRESS, senderAcc.address, hre.ethers.utils.parseUnits('0', 18));

            await depositToWeth(hre.ethers.utils.parseUnits('10', 18));
            await approve(WETH_ADDRESS, proxy.address);
            const pullTokenAction = new dfs.actions.basic.PullTokenAction(
                WETH_ADDRESS, senderAcc.address, hre.ethers.utils.parseUnits('3', 18),
            );
            const pullTokenData = pullTokenAction.encodeForDsProxyCall()[1];

            await executeAction('PullToken', pullTokenData, proxy);
            expect(await balanceOf(WETH_ADDRESS, proxy.address)).to.be.eq(hre.ethers.utils.parseUnits('3', 18));
        });

        it('... should pull tokens uint256.max direct action', async () => {
            const pullTokenAction = new dfs.actions.basic.PullTokenAction(
                WETH_ADDRESS, senderAcc.address, hre.ethers.constants.MaxUint256,
            );
            const pullTokenData = pullTokenAction.encodeForDsProxyCall()[1];

            await executeAction('PullToken', pullTokenData, proxy);

            expect(await balanceOf(WETH_ADDRESS, proxy.address)).to.be.eq(hre.ethers.utils.parseUnits('10', 18));
        });
    });
};

const changeOwnerTest = async () => {
    describe('Change owner', function () {
        this.timeout(80000);

        let senderAcc; let senderAcc2; let proxy;

        const ADMIN_VAULT = '0xCCf3d848e08b94478Ed8f46fFead3008faF581fD';

        before(async () => {
            await impersonateAccount(ADMIN_ACC);

            const signer = await hre.ethers.provider.getSigner(ADMIN_ACC);

            const adminVaultInstance = await hre.ethers.getContractFactory('AdminVault', signer);
            const adminVault = await adminVaultInstance.attach(ADMIN_VAULT);

            adminVault.connect(signer);

            // change owner in registry to dfsRegController
            await adminVault.changeOwner(DFS_REG_CONTROLLER);

            await stopImpersonatingAccount(ADMIN_ACC);

            senderAcc = (await hre.ethers.getSigners())[0];
            senderAcc2 = (await hre.ethers.getSigners())[1];
            proxy = await getProxy(senderAcc.address);
        });

        it('... should change owner of users DSProxy', async () => {
            const newOwner = senderAcc2.address;

            const oldOwner = await proxy.owner();

            await changeProxyOwner(proxy, newOwner);

            const changedOwner = await proxy.owner();
            console.log(oldOwner, changedOwner);

            expect(changedOwner).to.be.eq(newOwner);
        });

        it('... should change owner back', async () => {
            const newOwner = senderAcc.address;

            proxy = proxy.connect(senderAcc2);

            await changeProxyOwner(proxy, newOwner);

            const changedOwner = await proxy.owner();

            expect(changedOwner).to.be.eq(newOwner);
            await resetForkToBlock();
        });
    });
};
const automationV2UnsubTest = async () => {
    describe('AutomationV2-Unsubscribe', function () {
        this.timeout(1000000);

        before(async () => {
            const blockNum = 14368070;

            await resetForkToBlock(blockNum);
            expect(
                await hre.ethers.provider.getBlockNumber(),
                `This test should be ran at block number ${blockNum}`,
            ).to.eq(blockNum);
            await redeploy('AutomationV2Unsub');
        });

        it('... should unsubscribe Mcd subscription', async () => {
            const mcdSubscriptionsAddr = '0xC45d4f6B6bf41b6EdAA58B01c4298B8d9078269a';
            const CDP_OWNER_ACC = '0x8eceBBF3fA6d894476Cd9DD34D6A53DdD185233e';
            const cdpId = 20648;

            await impersonateAccount(CDP_OWNER_ACC);

            const ownerAcc = hre.ethers.provider.getSigner(CDP_OWNER_ACC);
            const ownerProxy = await getProxy(CDP_OWNER_ACC);
            const impersonatedProxy = ownerProxy.connect(ownerAcc);

            const mcdSubscriptions = new hre.ethers.Contract(
                mcdSubscriptionsAddr,
                ISubscriptionsABI,
                ownerAcc,
            );

            // eslint-disable-next-line no-unused-expressions
            expect(
                (await mcdSubscriptions['subscribersPos(uint256)'](cdpId)).subscribed,
                'The proxy isn\'t subscribed.',
            ).to.be.true;

            await automationV2Unsub(impersonatedProxy, '0', cdpId);

            // eslint-disable-next-line no-unused-expressions
            expect(
                (await mcdSubscriptions['subscribersPos(uint256)'](cdpId)).subscribed,
                'Couldn\'t unsubscribe the proxy.',
            ).to.be.false;

            await stopImpersonatingAccount(CDP_OWNER_ACC);
        });

        it('... should unsubscribe Compound subscription', async () => {
            const compoundSubscriptionsAddr = '0x52015EFFD577E08f498a0CCc11905925D58D6207';
            const COMPOUND_OWNER_ACC = '0xe10eB997d51C2AFCd3e0F80e0a984949b2ed3349';

            await impersonateAccount(COMPOUND_OWNER_ACC);

            const ownerAcc = hre.ethers.provider.getSigner(COMPOUND_OWNER_ACC);
            const ownerProxy = await getProxy(COMPOUND_OWNER_ACC);
            const impersonatedProxy = ownerProxy.connect(ownerAcc);

            const compoundSubscriptions = new hre.ethers.Contract(
                compoundSubscriptionsAddr,
                ISubscriptionsABI,
                ownerAcc,
            );

            // eslint-disable-next-line no-unused-expressions
            expect(
                (await compoundSubscriptions['subscribersPos(address)'](ownerProxy.address)).subscribed,
                'The proxy isn\'t subscribed.',
            ).to.be.true;

            await automationV2Unsub(impersonatedProxy, '1');

            // eslint-disable-next-line no-unused-expressions
            expect(
                (await compoundSubscriptions['subscribersPos(address)'](ownerProxy.address)).subscribed,
                'Couldn\'t unsubscribe the proxy.',
            ).to.be.false;

            await stopImpersonatingAccount(COMPOUND_OWNER_ACC);
        });

        it('... should unsubscribe Aave subscription', async () => {
            const aaveSubscriptionsAddr = '0x6B25043BF08182d8e86056C6548847aF607cd7CD';
            const AAVE_OWNER_ACC = '0x160FF555a7836d8bC027eDA92Fb524BecE5C9B88';

            await impersonateAccount(AAVE_OWNER_ACC);

            const ownerAcc = hre.ethers.provider.getSigner(AAVE_OWNER_ACC);
            const ownerProxy = await getProxy(AAVE_OWNER_ACC);
            const impersonatedProxy = ownerProxy.connect(ownerAcc);

            const aaveSubscriptions = new hre.ethers.Contract(
                aaveSubscriptionsAddr,
                ISubscriptionsABI,
                ownerAcc,
            );

            // eslint-disable-next-line no-unused-expressions
            expect(
                (await aaveSubscriptions['subscribersPos(address)'](ownerProxy.address)).subscribed,
                'The proxy isn\'t subscribed.',
            ).to.be.true;

            await automationV2Unsub(impersonatedProxy, '2');

            // eslint-disable-next-line no-unused-expressions
            expect(
                (await aaveSubscriptions['subscribersPos(address)'](ownerProxy.address)).subscribed,
                'Couldn\'t unsubscribe the proxy.',
            ).to.be.false;

            await stopImpersonatingAccount(AAVE_OWNER_ACC);
        });
    });
};
const deployUtilsActionsContracts = async () => {
    await redeploy('WrapEth');
    await redeploy('DFSSell');
    await redeploy('RecipeExecutor');
    await redeploy('UnwrapEth');
    await redeploy('PullToken');
    await redeploy('SumInputs');
    await redeploy('SubInputs');
    await redeploy('SendToken');
    await redeploy('UniswapWrapperV3');
    await redeploy('ChangeProxyOwner');
};

const utilsActionsFullTest = async () => {
    await deployUtilsActionsContracts();
    await wrapEthTest();
    await unwrapEthTest();
    await sumInputsTest();
    await subInputsTest();
    await sendTokenTest();
    await pullTokenTest();
    await changeOwnerTest();
    await automationV2UnsubTest();
};

module.exports = {
    wrapEthTest,
    unwrapEthTest,
    sumInputsTest,
    subInputsTest,
    sendTokenTest,
    changeOwnerTest,
    pullTokenTest,
    automationV2UnsubTest,
    utilsActionsFullTest,
};