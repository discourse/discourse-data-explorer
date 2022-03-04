export default {
  shouldRender(args) {
    return args.group.has_visible_data_explorer_queries;
  },
};
