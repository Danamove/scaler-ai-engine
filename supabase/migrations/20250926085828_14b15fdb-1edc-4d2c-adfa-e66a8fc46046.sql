-- Populate top universities table with data from all regions
INSERT INTO public.top_universities (university_name, country) VALUES
-- Israel
('Tel Aviv University', 'Israel'),
('Hebrew University of Jerusalem', 'Israel'),
('Technion – Israel Institute of Technology', 'Israel'),
('Weizmann Institute of Science', 'Israel'),
('Ben-Gurion University of the Negev', 'Israel'),
('Bar-Ilan University', 'Israel'),
('University of Haifa', 'Israel'),
('Open University of Israel', 'Israel'),

-- United States  
('Massachusetts Institute of Technology (MIT)', 'United States'),
('Stanford University', 'United States'),
('Harvard University', 'United States'),
('California Institute of Technology (Caltech)', 'United States'),
('Princeton University', 'United States'),
('Yale University', 'United States'),
('University of Chicago', 'United States'),
('Columbia University', 'United States'),
('University of California, Berkeley', 'United States'),

-- Europe
('University of Oxford', 'United Kingdom'),
('University of Cambridge', 'United Kingdom'),
('University College London', 'United Kingdom'),
('ETH Zürich', 'Switzerland'),
('Imperial College London', 'United Kingdom'),
('École Polytechnique', 'France'),
('Sorbonne University', 'France'),
('LMU Munich', 'Germany'),
('University of Amsterdam', 'Netherlands'),
('University of Copenhagen', 'Denmark'),

-- Canada
('University of Toronto', 'Canada'),
('University of British Columbia', 'Canada'),
('McGill University', 'Canada'),
('University of Alberta', 'Canada'),
('University of Waterloo', 'Canada'),
('University of Montreal', 'Canada'),
('McMaster University', 'Canada'),
('University of Calgary', 'Canada')

ON CONFLICT (university_name) DO NOTHING;