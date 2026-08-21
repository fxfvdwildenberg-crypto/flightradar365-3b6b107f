ALTER TABLE public.flight_plans ALTER COLUMN user_id DROP NOT NULL;

INSERT INTO public.flight_plans (user_id, callsign, airline, aircraft, dep_icao, arr_icao, dep_time, arr_time, cruise_alt, route, status) VALUES
  (NULL, 'BAW4723', 'British Airways', 'A320', 'IRFD', 'ILAR', now() - interval '22 minutes', now() + interval '18 minutes', 34000, 'DCT ALPHA DCT', 'active'),
  (NULL, 'QFA32', 'Qantas', '747-400', 'IPPH', 'IRFD', now() - interval '40 minutes', now() + interval '9 minutes', 38000, 'DCT', 'active'),
  (NULL, 'DLH121', 'Lufthansa', 'A350', 'ITKO', 'IPPH', now() - interval '12 minutes', now() + interval '33 minutes', 36000, 'DCT KILO DCT', 'active'),
  (NULL, 'FDX80', 'FedEx', 'MD11', 'IKFL', 'IRFD', now() - interval '5 minutes', now() + interval '41 minutes', 32000, 'DCT', 'active'),
  (NULL, 'SAR07', 'Island SAR', '412 Rescue', 'IRCG', 'IMLR', now() - interval '8 minutes', now() + interval '14 minutes', 4000, 'COASTAL', 'active'),
  (NULL, 'UAL998', 'United', 'Boeing 787-9', 'ILAR', 'IPPH', now() + interval '14 minutes', now() + interval '68 minutes', 37000, 'DCT', 'filed'),
  (NULL, 'CEBU46L', 'Cebu', 'ATR 72', 'IMLR', 'IRFD', now() + interval '6 minutes', now() + interval '29 minutes', 12000, 'DCT', 'filed'),
  (NULL, 'RYN39W', 'Ryan Air', 'Boeing 737', 'IZOL', 'IKFL', now() - interval '35 minutes', now() + interval '25 minutes', 35000, 'DCT ZULU DCT', 'active');

INSERT INTO public.atis (airport_icao, letter, runway_in_use, wind, visibility, clouds, temperature, qnh, remarks) VALUES
  ('IRFD', 'C', '27L', '250/12KT', '10KM', 'FEW030 SCT090', '18/12', '1013', 'Expect ILS approach runway 27L. Contact ground on pushback.'),
  ('IPPH', 'B', '06', '070/08KT', 'CAVOK', 'NIL', '24/09', '1018', 'Visual approaches in use. Birds reported near threshold 06.'),
  ('ILAR', 'A', '22', '200/15KT G22', '8KM', 'BKN025', '21/16', '1009', 'Moderate turbulence reported on final. Caution wake turbulence.');