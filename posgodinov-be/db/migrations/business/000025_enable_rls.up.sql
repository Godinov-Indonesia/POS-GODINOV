-- Enable RLS and Force it on all relevant tables
DO $$
DECLARE
    t_name text;
BEGIN
    FOR t_name IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'outlet_id' 
          AND table_schema = 'public'
    LOOP
        EXECUTE 'ALTER TABLE ' || t_name || ' ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'ALTER TABLE ' || t_name || ' FORCE ROW LEVEL SECURITY;';
        
        -- Create policy for the table
        EXECUTE '
            CREATE POLICY rls_outlet_isolation ON ' || t_name || '
            FOR ALL
            USING (
                current_setting(''app.current_outlet_id'', true) IS NULL 
                OR current_setting(''app.current_outlet_id'', true) = '''' 
                OR outlet_id = current_setting(''app.current_outlet_id'', true)
            );
        ';
    END LOOP;
    
    -- For outlets table itself, the column is 'id' not 'outlet_id'
    ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE outlets FORCE ROW LEVEL SECURITY;
    CREATE POLICY rls_outlets_isolation ON outlets
    FOR ALL
    USING (
        current_setting('app.current_outlet_id', true) IS NULL 
        OR current_setting('app.current_outlet_id', true) = '' 
        OR id = current_setting('app.current_outlet_id', true)
    );
END $$;
