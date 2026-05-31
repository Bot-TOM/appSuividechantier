-- Étend la contrainte de type des visites techniques pour autoriser 'custom'
ALTER TABLE visites_techniques
DROP CONSTRAINT IF EXISTS visites_techniques_type_check;

ALTER TABLE visites_techniques
ADD CONSTRAINT visites_techniques_type_check
CHECK (type IN ('btoc', 'btob', 'custom'));
