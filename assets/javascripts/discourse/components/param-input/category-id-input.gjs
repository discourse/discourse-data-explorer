import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import CategoryChooser from "select-kit/components/category-chooser";

export default class GroupListInput extends Component {
  @tracked value;
  constructor() {
    super(...arguments);
    this.value = this.args.field.value;
  }

  @action
  update(id) {
    this.value = id;
    this.args.field.set(id);
  }

  <template>
    <@field.Custom id={{@field.id}}>
      <CategoryChooser
        @value={{this.value}}
        @onChange={{this.update}}
        name={{@info.identifier}}
      />
    </@field.Custom>
  </template>
}
