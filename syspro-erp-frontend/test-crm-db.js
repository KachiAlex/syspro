#!/usr/bin/env node

/**
 * CRM Database Connection Test
 * Tests CRM database operations and table existence
 */

// Set environment variable
process.env.DATABASE_URL = "postgresql://neondb_owner:npg_0eOB6ifTWDaC@ep-twilight-dust-a40auvl2-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const { neon } = require("@neondatabase/serverless");

async function testCRMDatabase() {
    console.log('🔍 Testing CRM Database Connection...\n');
    
    try {
        // Test database connection
        const sql = neon(process.env.DATABASE_URL);
        console.log('✅ Database connection established');
        
        // Test if CRM tables exist
        console.log('\n📋 Checking CRM Tables...');
        
        const tables = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'crm_%'
            ORDER BY table_name
        `;
        
        console.log(`Found ${tables.length} CRM tables:`);
        tables.forEach(table => {
            console.log(`  ✅ ${table.table_name}`);
        });
        
        // Test CRM leads table structure
        console.log('\n🏗️ Testing CRM Leads Table Structure...');
        const leadColumns = await sql`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'crm_leads' 
            ORDER BY ordinal_position
        `;
        
        console.log('CRM Leads table columns:');
        leadColumns.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
        });
        
        // Test inserting a sample lead
        console.log('\n➕ Testing Lead Insertion...');
        const testLead = {
            id: 'test-lead-' + Date.now(),
            tenant_slug: 'kreatix-default',
            region_id: 'region-1',
            branch_id: 'branch-1',
            company_name: 'Test Company',
            contact_name: 'Test Contact',
            contact_email: 'test@example.com',
            source: 'website',
            stage: 'new'
        };
        
        const insertResult = await sql`
            INSERT INTO crm_leads (
                id, tenant_slug, region_id, branch_id, 
                company_name, contact_name, contact_email, 
                source, stage
            ) VALUES (
                ${testLead.id}, ${testLead.tenant_slug}, 
                ${testLead.region_id}, ${testLead.branch_id},
                ${testLead.company_name}, ${testLead.contact_name},
                ${testLead.contact_email}, ${testLead.source}, 
                ${testLead.stage}
            )
            RETURNING id, created_at
        `;
        
        console.log(`✅ Successfully inserted test lead: ${insertResult[0].id}`);
        
        // Test retrieving leads
        console.log('\n📖 Testing Lead Retrieval...');
        const leads = await sql`
            SELECT id, company_name, contact_name, stage, created_at
            FROM crm_leads 
            WHERE tenant_slug = ${'kreatix-default'}
            ORDER BY created_at DESC
            LIMIT 5
        `;
        
        console.log(`✅ Retrieved ${leads.length} leads:`);
        leads.forEach(lead => {
            console.log(`  - ${lead.company_name} (${lead.contact_name}) - ${lead.stage}`);
        });
        
        // Test cleanup
        console.log('\n🧹 Cleaning up test data...');
        await sql`DELETE FROM crm_leads WHERE id = ${testLead.id}`;
        console.log('✅ Test lead cleaned up');
        
        console.log('\n🎉 CRM Database Test Complete - All operations working!');
        
    } catch (error) {
        console.error('❌ CRM Database Test Failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the test
testCRMDatabase().catch(console.error);
