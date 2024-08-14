import Component from "@glimmer/component";
import { inject as service } from "@ember/service";
import GroupChooser from "select-kit/components/group-chooser";

export default class GroupListInput extends Component {
  @service site;

  get allGroups() {
    return this.site.get("groups");
  }

  <template>
    <@field.Custom id={{@field.id}}>
      <GroupChooser
        @content={{this.allGroups}}
        @value={{@field.value}}
        @labelProperty="name"
        @valueProperty="name"
        @onChange={{@field.set}}
      />
    </@field.Custom>
  </template>
}
