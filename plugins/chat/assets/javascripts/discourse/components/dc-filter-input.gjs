import Component from "@glimmer/component";
import { Input } from "@ember/component";
import { on } from "@ember/modifier";
import noop from "discourse/helpers/noop";
import concatClass from "discourse/helpers/concat-class";
import icon from "discourse-common/helpers/d-icon";
import { modifier } from "ember-modifier";
import { tracked } from "@glimmer/tracking";

export default class DcFilterInput extends Component {
  <template>
    {{! template-lint-disable modifier-name-case }}
    <div
      class={{concatClass
        @class
        "dc-filter-input-container"
        (if this.isFocused " is-focused")
      }}
    >
      {{#if @icons.left}}
        {{icon @icons.left class="-left"}}
      {{/if}}

      <Input
        class="dc-filter-input"
        @value={{@value}}
        {{on "input" (if @filterAction @filterAction (noop))}}
        {{this.focusState}}
        ...attributes
      />

      {{yield}}

      {{#if @icons.right}}
        {{icon @icons.right class="-right"}}
      {{/if}}
    </div>
  </template>

  @tracked isFocused = false;

  focusState = modifier((element) => {
    const focusInHandler = () => {
      this.isFocused = true;
    };
    const focusOutHandler = () => {
      this.isFocused = false;
    };

    element.addEventListener("focusin", focusInHandler);
    element.addEventListener("focusout", focusOutHandler);

    return () => {
      element.removeEventListener("focusin", focusInHandler);
      element.removeEventListener("focusout", focusOutHandler);
    };
  });
}
