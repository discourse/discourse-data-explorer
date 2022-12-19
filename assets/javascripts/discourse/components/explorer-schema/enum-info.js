import Component from "@glimmer/component";

export default class EnumInfo extends Component {
  get enuminfo() {
    return Object.entries(this.args.col.enum).map(([value, name]) => ({
      value,
      name,
    }));
  }
}
