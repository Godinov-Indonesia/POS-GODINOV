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
        EXECUTE 'DROP POLICY IF EXISTS rls_outlet_isolation ON ' || t_name || ';';
        EXECUTE 'ALTER TABLE ' || t_name || ' DISABLE ROW LEVEL SECURITY;';
    END LOOP;
    
    DROP POLICY IF EXISTS rls_outlets_isolation ON outlets;
    ALTER TABLE outlets DISABLE ROW LEVEL SECURITY;
END $$;
