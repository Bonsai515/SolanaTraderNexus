import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from '../shared/schema';

const sql = postgres(process.env.DATABASE_URL || '');
const db = drizzle(sql, { schema });

async function main() {
  console.log('Running database migrations...');
  
  // This creates the tables directly from our schema
  // We don't need a separate migration file since we're using schema-based migration
  try {
    // Create wallets table
    await sql`
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        balance NUMERIC NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `;
    console.log('Created wallets table');
    
    // Create strategies table
    await sql`
      CREATE TABLE IF NOT EXISTS strategies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        pair TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT false,
        parameters JSONB,
        wallet_id UUID REFERENCES wallets(id),
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `;
    console.log('Created strategies table');
    
    // Create trading_signals table
    await sql`
      CREATE TABLE IF NOT EXISTS trading_signals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pair TEXT NOT NULL,
        type TEXT NOT NULL,
        strength TEXT NOT NULL,
        price NUMERIC NOT NULL,
        strategy_id UUID REFERENCES strategies(id),
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        expires_at TIMESTAMP
      )
    `;
    console.log('Created trading_signals table');
    
    // Create transactions table
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_hash TEXT,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        amount NUMERIC NOT NULL,
        fee NUMERIC,
        wallet_id UUID REFERENCES wallets(id) NOT NULL,
        pair TEXT NOT NULL,
        signal_id UUID REFERENCES trading_signals(id),
        strategy_id UUID REFERENCES strategies(id),
        price NUMERIC,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        confirmed_at TIMESTAMP
      )
    `;
    console.log('Created transactions table');
    
    // Create learning_insights table
    await sql`
      CREATE TABLE IF NOT EXISTS learning_insights (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_type TEXT NOT NULL,
        strategy_id UUID REFERENCES strategies(id) NOT NULL,
        pair TEXT,
        insight_type TEXT NOT NULL,
        confidence NUMERIC NOT NULL,
        description TEXT NOT NULL,
        recommendation TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        applied BOOLEAN NOT NULL DEFAULT false,
        result JSONB
      )
    `;
    console.log('Created learning_insights table');

    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();