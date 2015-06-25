export default function() {
  this.resource('tags', function() {
    this.route('show', {path: ':tag_id'});
  });
}
