import ethers from "ethers";

const pancakeSwapRouterAddress = '0x67a5d237530c9e09a7b3fdf52071179f4621bb3d';
const benchAddress = '0xAFe48Cba47D3ffB3e988b7F329388495Cf2Fbcc8';
const WTLOSAddress = '0x5bf0E1Fa3B7988660E8d22860743BB289196f0ac';
const pairAddress = '0xfB7b8DC300661dD6b787cde08AF9CF4b1Db825B7';

const targetAccount = {
    address: '0xAFe48Cba47D3ffB3e988b7F329388495Cf2Fbcc8'
}

const router = new ethers.Contract(
    pancakeSwapRouterAddress,
    [
        'function getAmountsIn(uint256,address[] memory) view returns (uint256[] memory)',
        'function getAmountsOut(uint256,address[] memory) view returns (uint256[] memory)',
        'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
        'function swapExactETHForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
        'function WETH() external pure returns (address)',
        'function quote(uint amountA, uint reserveA, uint reserveB) public pure virtual override returns (uint amountB)'

    ],
    new ethers.providers.JsonRpcProvider('http://testrpc.us.telos.net:7000/evm')
);

(async () => {
    console.log(await router.WETH());
    //console.log(await router.getAmountsIn(100, [WTLOSAddress, benchAddress]));
    console.log(await router.getAmountsOut(100, [WTLOSAddress, benchAddress]));
    //console.log(await router.quote(100000, WTLOSAddress, benchAddress));
    console.log(await router.interface.decodeFunctionData('swapExactETHForTokens', '0xa5be382e00000000000000000000000000000000000000000000000000000000000186a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000d0f40133cdfde83a5deb111cf3e691bde3f53ea500000000000000000000000000000000000000000000000000000182ec14ddc400000000000000000000000000000000000000000000000000000000000000020000000000000000000000005bf0e1fa3b7988660e8d22860743bb289196f0ac000000000000000000000000afe48cba47d3ffb3e988b7f329388495cf2fbcc8'))
    return;
    var functionData = router.interface.encodeFunctionData('swapExactETHForTokens', [
        ethers.utils.parseEther("0.0001"),
        0,
        [benchAddress],
        targetAccount.address,
        Date.now() + 1000 * 60 * 10 * 100
    ])

    const opts = {
        'gasLimit': 300000,
        'gasPrice': ethers.utils.parseUnits('600', 'gwei'),
    };

    console.log(functionData);
})()
