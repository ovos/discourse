import DiscourseURL from "discourse/lib/url";
import I18n from "I18n";
import { addExtraUserClasses } from "discourse/helpers/user-avatar";
import { avatarImg } from "discourse/widgets/post";
import { createWidget } from "discourse/widgets/widget";
import getURL from "discourse-common/lib/get-url";
import { h } from "virtual-dom";
import { iconNode } from "discourse-common/lib/icon-library";
import { schedule } from "@ember/runloop";
import { scrollTop } from "discourse/mixins/scroll-top";
import { wantsNewWindow } from "discourse/lib/intercept-click";
import { logSearchLinkClick } from "discourse/lib/search";
import RenderGlimmer from "discourse/widgets/render-glimmer";
import { hbs } from "ember-cli-htmlbars";
import { SEARCH_BUTTON_ID } from "discourse/components/search-menu";

let _extraHeaderIcons = [];

export function addToHeaderIcons(icon) {
  _extraHeaderIcons.push(icon);
}

export function clearExtraHeaderIcons() {
  _extraHeaderIcons = [];
}

export const dropdown = {
  buildClasses(attrs) {
    let classes = attrs.classNames || [];
    if (attrs.active) {
      classes.push("active");
    }

    return classes;
  },

  click(e) {
    if (wantsNewWindow(e)) {
      return;
    }
    e.preventDefault();
    if (!this.attrs.active) {
      this.sendWidgetAction(this.attrs.action);
    }
  },
};

createWidget("header-notifications", {
  services: ["user-tips"],

  settings: {
    avatarSize: "medium",
  },

  html(attrs) {
    const { user } = attrs;

    let avatarAttrs = {
      template: user.get("avatar_template"),
      username: user.get("username"),
    };

    if (this.siteSettings.enable_names) {
      avatarAttrs.name = user.get("name");
    }

    const contents = [
      avatarImg(
        this.settings.avatarSize,
        Object.assign(
          { alt: "user.avatar.header_title" },
          addExtraUserClasses(user, avatarAttrs)
        )
      ),
    ];

    if (this.currentUser && this._shouldHighlightAvatar()) {
      contents.push(this.attach("header-user-tip-shim"));
    }

    if (this.currentUser.status) {
      contents.push(this.attach("user-status-bubble", this.currentUser.status));
    }

    if (user.isInDoNotDisturb()) {
      contents.push(h("div.do-not-disturb-background", iconNode("moon")));
    } else {
      if (user.new_personal_messages_notifications_count) {
        contents.push(
          this.attach("link", {
            action: attrs.action,
            className: "badge-notification with-icon new-pms",
            icon: "envelope",
            omitSpan: true,
            title: "notifications.tooltip.new_message_notification",
            titleOptions: {
              count: user.new_personal_messages_notifications_count,
            },
            attributes: {
              "aria-label": I18n.t(
                "notifications.tooltip.new_message_notification",
                {
                  count: user.new_personal_messages_notifications_count,
                }
              ),
            },
          })
        );
      } else if (user.unseen_reviewable_count) {
        contents.push(
          this.attach("link", {
            action: attrs.action,
            className: "badge-notification with-icon new-reviewables",
            icon: "flag",
            omitSpan: true,
            title: "notifications.tooltip.new_reviewable",
            titleOptions: { count: user.unseen_reviewable_count },
            attributes: {
              "aria-label": I18n.t("notifications.tooltip.new_reviewable", {
                count: user.unseen_reviewable_count,
              }),
            },
          })
        );
      } else if (user.all_unread_notifications_count) {
        contents.push(
          this.attach("link", {
            action: attrs.action,
            className: "badge-notification unread-notifications",
            rawLabel: user.all_unread_notifications_count,
            omitSpan: true,
            title: "notifications.tooltip.regular",
            titleOptions: { count: user.all_unread_notifications_count },
            attributes: {
              "aria-label": I18n.t("user.notifications"),
            },
          })
        );
      }
    }

    return contents;
  },

  _shouldHighlightAvatar() {
    const attrs = this.attrs;
    const { user } = attrs;
    return (
      !user.read_first_notification &&
      !user.enforcedSecondFactor &&
      !attrs.active
    );
  },
});

createWidget(
  "user-dropdown",
  Object.assign(
    {
      tagName: "li.header-dropdown-toggle.current-user",

      buildId() {
        return "current-user";
      },

      html(attrs) {
        return h(
          "button.icon.btn-flat",
          {
            attributes: {
              "aria-haspopup": true,
              "aria-expanded": attrs.active,
              href: attrs.user.path,
              title: attrs.user.name || attrs.user.username,
              "data-auto-route": true,
            },
          },
          this.attach("header-notifications", attrs)
        );
      },
    },
    dropdown
  )
);

createWidget(
  "header-dropdown",
  Object.assign(
    {
      tagName: "li.header-dropdown-toggle",

      html(attrs) {
        const title = I18n.t(attrs.title);

        const body = [iconNode(attrs.icon)];
        if (attrs.contents) {
          body.push(attrs.contents.call(this));
        }

        return h(
          "button.icon.btn-flat",
          {
            attributes: {
              "aria-expanded": attrs.active,
              "aria-haspopup": true,
              href: attrs.href,
              "data-auto-route": true,
              title,
              "aria-label": title,
              id: attrs.iconId,
            },
          },
          body
        );
      },
    },
    dropdown
  )
);

createWidget("header-icons", {
  services: ["search"],
  tagName: "ul.icons.d-header-icons",

  html(attrs) {
    if (this.siteSettings.login_required && !this.currentUser) {
      return [];
    }

    const icons = [];

    if (_extraHeaderIcons) {
      _extraHeaderIcons.forEach((icon) => {
        icons.push(this.attach(icon));
      });
    }

    const search = this.attach("header-dropdown", {
      title: "search.title",
      icon: "search",
      iconId: SEARCH_BUTTON_ID,
      action: "toggleSearchMenu",
      active: attrs.searchVisible || this.search.visible,
      href: getURL("/search"),
      classNames: ["search-dropdown"],
    });

    icons.push(search);

    const hamburger = this.attach("header-dropdown", {
      title: "hamburger_menu",
      icon: "bars",
      iconId: "toggle-hamburger-menu",
      active: attrs.hamburgerVisible,
      action: "toggleHamburger",
      href: "",
      classNames: ["hamburger-dropdown"],
    });

    if (!attrs.sidebarEnabled || this.site.mobileView) {
      icons.push(hamburger);
    }

    if (attrs.user) {
      icons.push(
        this.attach("user-dropdown", {
          active: attrs.userVisible,
          action: "toggleUserMenu",
          user: attrs.user,
        })
      );
    }

    return icons;
  },
});

createWidget("header-buttons", {
  tagName: "span.header-buttons",

  html(attrs) {
    if (this.currentUser) {
      return;
    }

    const buttons = [];

    if (attrs.canSignUp && !attrs.topic) {
      buttons.push(
        this.attach("button", {
          label: "sign_up",
          className: "btn-primary btn-small sign-up-button",
          action: "showCreateAccount",
        })
      );
    }

    buttons.push(
      this.attach("button", {
        label: "log_in",
        className: "btn-primary btn-small login-button",
        action: "showLogin",
        icon: "user",
      })
    );
    return buttons;
  },
});

createWidget("header-cloak", {
  tagName: "div.header-cloak",
  html() {
    return "";
  },
  click() {},
  scheduleRerender() {},
});

let additionalPanels = [];
export function attachAdditionalPanel(name, toggle, transformAttrs) {
  additionalPanels.push({ name, toggle, transformAttrs });
}

createWidget("revamped-hamburger-menu-wrapper", {
  buildAttributes() {
    return { "data-click-outside": true };
  },

  html() {
    return [
      new RenderGlimmer(
        this,
        "div.widget-component-connector",
        hbs`<Sidebar::HamburgerDropdown />`
      ),
    ];
  },

  click(event) {
    if (
      event.target.closest(".sidebar-section-header-button") ||
      event.target.closest(".sidebar-section-link-button") ||
      event.target.closest(".sidebar-section-link")
    ) {
      this.sendWidgetAction("toggleHamburger");
    }
  },

  clickOutside() {
    this.sendWidgetAction("toggleHamburger");
  },
});

createWidget("revamped-user-menu-wrapper", {
  buildAttributes() {
    return { "data-click-outside": true };
  },

  html() {
    return [
      new RenderGlimmer(
        this,
        "div.widget-component-connector",
        hbs`<UserMenu::Menu @closeUserMenu={{@data.closeUserMenu}} />`,
        {
          closeUserMenu: this.closeUserMenu.bind(this),
        }
      ),
    ];
  },

  closeUserMenu() {
    this.sendWidgetAction("toggleUserMenu");
  },

  clickOutside() {
    this.closeUserMenu();
  },
});

createWidget("glimmer-search-menu-wrapper", {
  services: ["search"],
  buildAttributes() {
    return { "data-click-outside": true, "aria-live": "polite" };
  },

  buildClasses() {
    return ["search-menu glimmer-search-menu"];
  },

  html() {
    return [
      new RenderGlimmer(
        this,
        "div.widget-component-connector",
        hbs`<SearchMenu @closeSearchMenu={{@data.closeSearchMenu}} />`,
        { closeSearchMenu: this.closeSearchMenu.bind(this) }
      ),
    ];
  },

  closeSearchMenu() {
    this.sendWidgetAction("toggleSearchMenu");
  },

  clickOutside() {
    this.closeSearchMenu();
  },
});

export default createWidget("header", {
  tagName: "header.d-header",
  buildKey: () => `header`,
  services: ["router", "search"],

  defaultState() {
    let states = {
      searchVisible: false,
      hamburgerVisible: false,
      userVisible: false,
      inTopicContext: false,
    };

    if (this.site.mobileView) {
      states.skipSearchContext = true;
    }

    return states;
  },

  html(attrs, state) {
    let inTopicRoute = false;
    if (this.state.inTopicContext || this.search.inTopicContext) {
      inTopicRoute = this.router.currentRouteName.startsWith("topic.");
    }

    let contents = () => {
      const headerIcons = this.attach("header-icons", {
        hamburgerVisible: state.hamburgerVisible,
        userVisible: state.userVisible,
        searchVisible: state.searchVisible || this.search.visible,
        flagCount: attrs.flagCount,
        user: this.currentUser,
        sidebarEnabled: attrs.sidebarEnabled,
      });

      if (attrs.onlyIcons) {
        return headerIcons;
      }

      const panels = [this.attach("header-buttons", attrs), headerIcons];

      if (state.searchVisible || this.search.visible) {
        if (this.currentUser?.experimental_search_menu_groups_enabled) {
          this.search.inTopicContext =
            this.search.inTopicContext && inTopicRoute;
          panels.push(this.attach("glimmer-search-menu-wrapper"));
        } else {
          panels.push(
            this.attach("search-menu", {
              inTopicContext: state.inTopicContext && inTopicRoute,
            })
          );
        }
      } else if (state.hamburgerVisible) {
        if (
          attrs.navigationMenuQueryParamOverride === "header_dropdown" ||
          !attrs.sidebarEnabled ||
          this.site.narrowDesktopView
        ) {
          panels.push(this.attach("revamped-hamburger-menu-wrapper", {}));
        } else {
          panels.push(this.attach("hamburger-menu"));
        }
      } else if (state.userVisible) {
        panels.push(this.attach("revamped-user-menu-wrapper", {}));
      }

      additionalPanels.map((panel) => {
        if (this.state[panel.toggle]) {
          panels.push(
            this.attach(
              panel.name,
              panel.transformAttrs.call(this, attrs, state)
            )
          );
        }
      });

      if (this.site.mobileView || this.site.narrowDesktopView) {
        panels.push(this.attach("header-cloak"));
      }

      return panels;
    };

    const contentsAttrs = {
      contents,
      minimized: !!attrs.topic,
    };

    return h(
      "div.wrap",
      this.attach("header-contents", { ...attrs, ...contentsAttrs })
    );
  },

  updateHighlight() {
    if (!this.state.searchVisible || !this.search.visible) {
      this.search.highlightTerm = "";
    }
  },

  closeAll() {
    this.state.userVisible = false;
    this.state.hamburgerVisible = false;
    this.state.searchVisible = false;
    this.search.visible = false;
    this.toggleBodyScrolling(false);
  },

  linkClickedEvent(attrs) {
    let searchContextEnabled = false;
    if (attrs) {
      searchContextEnabled = attrs.searchContextEnabled;

      const { searchLogId, searchResultId, searchResultType } = attrs;
      if (searchLogId && searchResultId && searchResultType) {
        logSearchLinkClick({ searchLogId, searchResultId, searchResultType });
      }
    }

    if (!searchContextEnabled) {
      this.closeAll();
    }

    this.updateHighlight();
  },

  toggleSearchMenu() {
    if (this.site.mobileView) {
      const context = this.search.searchContext;
      let params = "";

      if (context) {
        params = `?context=${context.type}&context_id=${context.id}&skip_context=${this.state.skipSearchContext}`;
      }

      if (this.router.currentRouteName === "full-page-search") {
        scrollTop();
        $(".full-page-search").focus();
        return false;
      } else {
        return DiscourseURL.routeTo("/search" + params);
      }
    }

    this.state.searchVisible = !this.state.searchVisible;
    this.search.visible = !this.search.visible;
    this.updateHighlight();

    if (this.state.searchVisible) {
      // only used by the widget search-menu
      this.focusSearchInput();
    } else {
      this.state.inTopicContext = false;
      this.search.inTopicContext = false;
    }
  },

  toggleUserMenu() {
    this.state.userVisible = !this.state.userVisible;
    this.toggleBodyScrolling(this.state.userVisible);

    // auto focus on first button in dropdown
    schedule("afterRender", () =>
      document.querySelector(".user-menu button")?.focus()
    );
  },

  toggleHamburger() {
    if (this.attrs.sidebarEnabled && !this.site.narrowDesktopView) {
      this.sendWidgetAction("toggleSidebar");
    } else {
      this.state.hamburgerVisible = !this.state.hamburgerVisible;
      this.toggleBodyScrolling(this.state.hamburgerVisible);

      schedule("afterRender", () => {
        // Remove focus from hamburger toggle button
        document.querySelector("#toggle-hamburger-menu")?.blur();
      });
    }
  },

  toggleBodyScrolling(bool) {
    if (!this.site.mobileView) {
      return;
    }
    if (bool) {
      document.body.addEventListener("touchmove", this.preventDefault, {
        passive: false,
      });
    } else {
      document.body.removeEventListener("touchmove", this.preventDefault, {
        passive: false,
      });
    }
  },

  preventDefault(e) {
    const windowHeight = window.innerHeight;

    // allow profile menu tabs to scroll if they're taller than the window
    if (e.target.closest(".menu-panel .menu-tabs-container")) {
      const topTabs = document.querySelector(".menu-panel .top-tabs");
      const bottomTabs = document.querySelector(".menu-panel .bottom-tabs");
      const profileTabsHeight =
        topTabs?.offsetHeight + bottomTabs?.offsetHeight || 0;

      if (profileTabsHeight > windowHeight) {
        return;
      }
    }

    // allow menu panels to scroll if contents are taller than the window
    if (e.target.closest(".menu-panel")) {
      const menuContentHeight =
        document.querySelector(".menu-panel .panel-body-contents")
          .offsetHeight || 0;

      if (menuContentHeight > windowHeight) {
        return;
      }
    }

    e.preventDefault();
  },

  togglePageSearch() {
    const { state } = this;
    this.search.inTopicContext = false;
    state.inTopicContext = false;

    let showSearch = this.router.currentRouteName.startsWith("topic.");

    // If we're viewing a topic, only intercept search if there are cloaked posts
    if (showSearch) {
      const controller = this.register.lookup("controller:topic");
      const total = controller.get("model.postStream.stream.length") || 0;
      const chunkSize = controller.get("model.chunk_size") || 0;

      showSearch =
        total > chunkSize &&
        $(".topic-post .cooked, .small-action:not(.time-gap)").length < total;
    }

    if (state.searchVisible || this.search.visible) {
      this.toggleSearchMenu();
      return showSearch;
    }

    if (showSearch) {
      state.inTopicContext = true;
      this.search.inTopicContext = true;
      this.toggleSearchMenu();
      return false;
    }

    return true;
  },

  domClean() {
    const { state } = this;

    if (
      state.searchVisible ||
      this.search.visible ||
      state.hamburgerVisible ||
      state.userVisible
    ) {
      this.closeAll();
    }
  },

  headerKeyboardTrigger(msg) {
    switch (msg.type) {
      case "search":
        this.toggleSearchMenu();
        break;
      case "user":
        this.toggleUserMenu();
        break;
      case "hamburger":
        this.toggleHamburger();
        break;
      case "page-search":
        if (!this.togglePageSearch()) {
          msg.event.preventDefault();
          msg.event.stopPropagation();
        }
        break;
    }
  },

  // only used by the widget search-menu
  focusSearchInput() {
    if (
      this.state.searchVisible &&
      !this.currentUser?.experimental_search_menu_groups_enabled
    ) {
      schedule("afterRender", () => {
        const searchInput = document.querySelector("#search-term");
        searchInput.focus();
        searchInput.select();
      });
    }
  },

  // only used by the widget search-menu
  setTopicContext() {
    this.state.inTopicContext = true;
    this.focusSearchInput();
  },

  // only used by the widget search-menu
  clearContext() {
    this.state.inTopicContext = false;
    this.focusSearchInput();
  },
});
