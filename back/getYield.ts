import express, { Request, Response } from 'express';
import { getBoundsLiquidity, getDistribution } from './getLiquidityPoolBounds';
import { AnchorProvider, BN } from '@project-serum/anchor';
import {
  WhirlpoolContext,
  AccountFetcher,
  buildWhirlpoolClient,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  PriceMath,
  PoolUtil,
  TickUtil,
  PDAUtil,
  TICK_ARRAY_SIZE,
} from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
import { DecimalUtil, MathUtil } from '@orca-so/common-sdk';
import Decimal from 'decimal.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.post('/calculate-yield', async (req: Request, res: Response) => {
  try {
    const { poolStr, minPrice, maxPrice, FeeRate, capitalDeposited, shortPosition, shortFee } = req.body;

    let pool = new PublicKey(poolStr);

    const provider = AnchorProvider.env();
    const ctx = WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID);
    const client = buildWhirlpoolClient(ctx);
    const poolData = await client.getPool(pool);
    await poolData.refreshData();

    const liquidityDistribution = await getDistribution(ctx, poolData, pool);

    const boundsLiquidity = await getBoundsLiquidity(minPrice, maxPrice, liquidityDistribution);
    console.log(`Liquidity between ${minPrice} and ${maxPrice}: ${boundsLiquidity}`);

    let Yield =
      ((FeeRate * capitalDeposited) / (boundsLiquidity / capitalDeposited)) - (shortPosition * shortFee);

    console.log(`Yield = ${Yield}`);

    res.json({ yield: Yield , liquidity: boundsLiquidity});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
