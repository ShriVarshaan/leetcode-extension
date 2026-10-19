-- Reweight topics by real interview frequency instead of list problem counts. Range stays [0.5, 2.0].

update public.topic_weights w
set weight = v.weight, source = 'interview-freq-2026-10-19'
from (values
  ('Arrays & Hashing', 2.00),
  ('Trees', 1.70),
  ('Graphs', 1.60),
  ('Two Pointers', 1.40),
  ('Sliding Window', 1.40),
  ('1-D Dynamic Programming', 1.30),
  ('Binary Search', 1.30),
  ('Heap / Priority Queue', 1.20),
  ('Intervals', 1.10),
  ('Stack', 1.10),
  ('Linked List', 1.00),
  ('Backtracking', 1.00),
  ('2-D Dynamic Programming', 1.00),
  ('Greedy', 0.90),
  ('Advanced Graphs', 0.80),
  ('Tries', 0.70),
  ('Math & Geometry', 0.60),
  ('Bit Manipulation', 0.50)
) as v(topic, weight)
where w.topic = v.topic;
