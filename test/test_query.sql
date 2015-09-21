SELECT
  (SELECT id FROM badges LIMIT 1) as badge_id,
  (SELECT id FROM categories LIMIT 1) as category_id,
  (SELECT id FROM groups LIMIT 1) as group_id,
  '<h2 class="fa fa-google"> hello</h2>' as html$html,
  (SELECT id FROM posts LIMIT 1) as post_id,
  'hello' as text$text,
  (SELECT id FROM topics LIMIT 1) as topic_id,
  (SELECT id FROM users LIMIT 1) as user_id,
  TIMESTAMP 'yesterday' as reltime$time,
  1 as end
