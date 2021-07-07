import Component from "@ember/component";
import { action } from "@ember/object";
import { empty } from "@ember/object/computed";
import { default as computed } from "discourse-common/utils/decorators";
import I18n from "I18n";

export default Component.extend({
  acceptedFileTypes: null,
  acceptAnyFile: empty("acceptedFileTypes"),

  didInsertElement() {
    this._super(...arguments);
    this._bindControls();
  },

  @computed
  acceptedFileTypesString() {
    if (!this.acceptedFileTypes) {
      return null;
    }

    return this.acceptedFileTypes.join(",");
  },

  @computed
  acceptedExtensions() {
    if (!this.acceptedFileTypes) {
      return null;
    }

    return this.acceptedFileTypes
      .filter((type) => type.startsWith("."))
      .map((type) => type.substring(1));
  },

  @computed
  acceptedMimeTypes() {
    if (!this.acceptedFileTypes) {
      return null;
    }

    return this.acceptedFileTypes.filter((type) => !type.startsWith("."));
  },

  @action
  openSystemModal() {
    document.querySelector("#file-input").click();
  },

  _bindControls() {
    const fileInput = document.getElementById("file-input");
    $(fileInput).on("change", () => {
      const files = fileInput.files;
      this._filesChosen(files);
    });
  },

  _filesChosen(files) {
    if (!files || !files.length) {
      return;
    }

    if (!this._haveAcceptedTypes(files)) {
      const message = I18n.t("upload_files_button.unsupported_file_types", {
        types: this.acceptedFileTypesString,
      });
      bootbox.alert(message);
      return;
    }
    this.onFilesChosen(files);
  },

  _haveAcceptedTypes(files) {
    for (const file of files) {
      if (
        !(this._hasAcceptedExtension(file) && this._hasAcceptedMimeType(file))
      ) {
        return false;
      }
    }
    return true;
  },

  _hasAcceptedExtension(file) {
    const extension = this._fileExtension(file.name);
    return (
      !this.acceptedExtensions || this.acceptedExtensions.includes(extension)
    );
  },

  _hasAcceptedMimeType(file) {
    return (
      !this.acceptedMimeTypes || this.acceptedMimeTypes.includes(file.type)
    );
  },

  _fileExtension(fileName) {
    return fileName.split(".").pop();
  },
});
