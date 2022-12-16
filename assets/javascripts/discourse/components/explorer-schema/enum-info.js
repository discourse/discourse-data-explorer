import Component from "@glimmer/component";

export default class ParamInput extends Component {
  get enuminfo() {
    const hash = this.args.col.enum;
    let result = [];
    for (let key in hash) {
      if (!hash.hasOwnProperty(key)) {
        continue;
      }
      result.push({ value: key, name: hash[key] });
    }
    return result;
  }
}
