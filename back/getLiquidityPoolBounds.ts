import { AnchorProvider, BN } from "@project-serum/anchor";
import {
  WhirlpoolContext, AccountFetcher, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID, PriceMath, PoolUtil, TickUtil, PDAUtil, TICK_ARRAY_SIZE
} from "@orca-so/whirlpools-sdk";

import { PublicKey } from "@solana/web3.js";
import { DecimalUtil, MathUtil } from "@orca-so/common-sdk";
import Decimal from "decimal.js";

process.env.ANCHOR_PROVIDER_URL = "https://api.mainnet-beta.solana.com";
process.env.ANCHOR_WALLET = "./wallet.json";

export async function getDistribution(ctx,poolData,pool) {
  

  const TICKARRAY_LOWER_OFFSET = -50;
  const TICKARRAY_UPPER_OFFSET = +50;
  const tickarray_start_indexes: number[] = [];
  const tickarray_pubkeys: PublicKey[] = [];
  const liquidity_distribution = [];
  let liquidity = new BN(0);
  let liquidity_difference;
  
  for (let offset = TICKARRAY_LOWER_OFFSET; offset <= TICKARRAY_UPPER_OFFSET; offset++) {
    const start_tick_index = TickUtil.getStartTickIndex(poolData.getData().tickCurrentIndex, poolData.getData().tickSpacing, offset);
    const pda = PDAUtil.getTickArrayFromTickIndex(start_tick_index, poolData.getData().tickSpacing, pool, ORCA_WHIRLPOOL_PROGRAM_ID);
    tickarray_start_indexes.push(start_tick_index);
    tickarray_pubkeys.push(pda.publicKey);
  }
  
  const tickarrays = await ctx.fetcher.listTickArrays(tickarray_pubkeys, true);
  const current_initializable_tick_index = Math.floor(poolData.getData().tickCurrentIndex / poolData.getData().tickSpacing) * poolData.getData().tickSpacing;
  const current_pool_liquidity = poolData.getData().liquidity;
  
  for (let ta = 0; ta < tickarrays.length; ta++) {
    const tickarray = tickarrays[ta];

    for (let i = 0; i < TICK_ARRAY_SIZE; i++) {
      const tick_index = tickarray_start_indexes[ta] + i * poolData.getData().tickSpacing;
      liquidity = tickarray == null ? liquidity : liquidity.add(tickarray.ticks[i].liquidityNet);
      liquidity_distribution.push({ tick_index, liquidity });
      
      if (tick_index === current_initializable_tick_index) {
        liquidity_difference = current_pool_liquidity.sub(liquidity);
      }
    }
  }
  
  for (let i = 0; i < liquidity_distribution.length; i++) {
    liquidity_distribution[i].liquidity = liquidity_distribution[i].liquidity.add(liquidity_difference);
    const price = PriceMath.sqrtPriceX64ToPrice(poolData.getData().sqrtPrice, 9, 6);

    const amounts = PoolUtil.getTokenAmountsFromLiquidity(
      liquidity_distribution[i].liquidity,
      poolData.getData().sqrtPrice,
      PriceMath.tickIndexToSqrtPriceX64(liquidity_distribution[i].tick_index),
      PriceMath.tickIndexToSqrtPriceX64(liquidity_distribution[i].tick_index+poolData.getData().tickSpacing),
      true
    );
    
  let amount1= DecimalUtil.fromU64(amounts.tokenA, 9).toNumber()
  let amount2= DecimalUtil.fromU64(amounts.tokenB, 6).toNumber()
  //console.log({amount1,amount2,price:price.toNumber()})
  liquidity_distribution[i].amounts = amount1*price.toNumber()+amount2;

  }
  
  return liquidity_distribution;
}

export async function getBoundsLiquidity(minPrice, maxPrice,liquidityDistribution) {
  const boundsLiquidity = liquidityDistribution
    .filter((data) => {
      const price = PriceMath.tickIndexToPrice(data.tick_index, 9, 6).toFixed(6).toString().padStart(11, " ")
       console.log(
        "tick_index:", data.tick_index.toString().padStart(6, " "),
        "/ price:", price,
        "/ liquidity:", data.liquidity.toString().padStart(20, " "),
        "/ amounts:", data.amounts.toString()
       // L.tick_index === current_initializable_tick_index ? " <== CURRENT" : ""
      );
      return price >= minPrice && price <= maxPrice;
    })
    .reduce((sum, data) => sum+(data.amounts), 0);
   // .reduce((sum, data) => sum.add(data.liquidity), new BN(0));
  return boundsLiquidity;
}

/* async function main() {
  let pool = new PublicKey("7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoVNUJnm");

  const provider = AnchorProvider.env();
  const ctx = WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID);
  const client = buildWhirlpoolClient(ctx);
  const poolData = await client.getPool(pool);
  await poolData.refreshData();
  

  const liquidityDistribution = await getDistribution(ctx,poolData,pool);

  // Print liquidity distribution
  for (let i = 0; i < liquidityDistribution.length; i++) {
    const L = liquidityDistribution[i];
  }

  const minPrice = 0; // Replace with your minimum price
  const maxPrice = 1000; // Replace with your maximum price
  const boundsLiquidity = await getBoundsLiquidity(minPrice, maxPrice, liquidityDistribution);
  console.log(`Liquidity between ${minPrice} and ${maxPrice}: ${boundsLiquidity}`);
  
}

main(); */
