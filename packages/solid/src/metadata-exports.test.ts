import { describe, expect, it } from "vite-plus/test";

import * as Accordion from "./accordion/index";
import * as AlertDialog from "./alert-dialog/index";
import * as Autocomplete from "./autocomplete/index";
import * as Avatar from "./avatar/index";
import * as Button from "./button/index";
import * as CheckboxGroup from "./checkbox-group/index";
import * as Checkbox from "./checkbox/index";
import * as Collapsible from "./collapsible/index";
import * as Combobox from "./combobox/index";
import * as ContextMenu from "./context-menu/index";
import * as Dialog from "./dialog/index";
import * as Drawer from "./drawer/index";
import * as Field from "./field/index";
import * as Fieldset from "./fieldset/index";
import * as Input from "./input/index";
import * as Menu from "./menu/index";
import * as Menubar from "./menubar/index";
import * as NavigationMenu from "./navigation-menu/index";
import * as NumberField from "./number-field/index";
import * as OTPField from "./otp-field/index";
import * as Popover from "./popover/index";
import * as PreviewCard from "./preview-card/index";
import * as Progress from "./progress/index";
import * as RadioGroup from "./radio-group/index";
import * as Radio from "./radio/index";
import * as ScrollArea from "./scroll-area/index";
import * as Select from "./select/index";
import * as Separator from "./separator/index";
import * as Slider from "./slider/index";
import * as Switch from "./switch/index";
import * as Tabs from "./tabs/index";
import * as Toast from "./toast/index";
import * as ToggleGroup from "./toggle-group/index";
import * as Toggle from "./toggle/index";
import * as Toolbar from "./toolbar/index";
import * as Tooltip from "./tooltip/index";

const EXPECTED: Array<[Record<string, unknown>, string, string]> = [
  [Accordion, "AccordionRootDataAttributes", "accordion"],
  [Accordion, "AccordionItemDataAttributes", "accordion"],
  [Accordion, "AccordionHeaderDataAttributes", "accordion"],
  [Accordion, "AccordionTriggerDataAttributes", "accordion"],
  [Accordion, "AccordionPanelCssVariables", "accordion"],
  [Accordion, "AccordionPanelDataAttributes", "accordion"],
  [AlertDialog, "AlertDialogBackdropDataAttributes", "alert-dialog"],
  [AlertDialog, "AlertDialogCloseDataAttributes", "alert-dialog"],
  [AlertDialog, "AlertDialogPopupCssVariables", "alert-dialog"],
  [AlertDialog, "AlertDialogPopupDataAttributes", "alert-dialog"],
  [AlertDialog, "AlertDialogTriggerDataAttributes", "alert-dialog"],
  [AlertDialog, "AlertDialogViewportDataAttributes", "alert-dialog"],
  [Avatar, "AvatarImageDataAttributes", "avatar"],
  [Button, "ButtonDataAttributes", "button"],
  [Checkbox, "CheckboxRootDataAttributes", "checkbox"],
  [Checkbox, "CheckboxIndicatorDataAttributes", "checkbox"],
  [CheckboxGroup, "CheckboxGroupDataAttributes", "checkbox-group"],
  [Collapsible, "CollapsibleRootDataAttributes", "collapsible"],
  [Collapsible, "CollapsibleTriggerDataAttributes", "collapsible"],
  [Collapsible, "CollapsiblePanelCssVariables", "collapsible"],
  [Collapsible, "CollapsiblePanelDataAttributes", "collapsible"],
  [Combobox, "ComboboxInputDataAttributes", "combobox"],
  [Combobox, "ComboboxInputGroupDataAttributes", "combobox"],
  [Combobox, "ComboboxTriggerDataAttributes", "combobox"],
  [Combobox, "ComboboxBackdropDataAttributes", "combobox"],
  [Combobox, "ComboboxPositionerCssVariables", "combobox"],
  [Combobox, "ComboboxPositionerDataAttributes", "combobox"],
  [Combobox, "ComboboxPopupDataAttributes", "combobox"],
  [Combobox, "ComboboxArrowDataAttributes", "combobox"],
  [Combobox, "ComboboxItemDataAttributes", "combobox"],
  [Combobox, "ComboboxItemIndicatorDataAttributes", "combobox"],
  [Combobox, "ComboboxClearDataAttributes", "combobox"],
  [Combobox, "ComboboxSeparatorDataAttributes", "combobox"],
  [Dialog, "DialogBackdropDataAttributes", "dialog"],
  [Dialog, "DialogCloseDataAttributes", "dialog"],
  [Dialog, "DialogPopupCssVariables", "dialog"],
  [Dialog, "DialogPopupDataAttributes", "dialog"],
  [Dialog, "DialogViewportDataAttributes", "dialog"],
  [Dialog, "DialogTriggerDataAttributes", "dialog"],
  [Drawer, "DrawerBackdropCssVariables", "drawer"],
  [Drawer, "DrawerBackdropDataAttributes", "drawer"],
  [Drawer, "DrawerPopupCssVariables", "drawer"],
  [Drawer, "DrawerPopupDataAttributes", "drawer"],
  [Drawer, "DrawerSwipeAreaDataAttributes", "drawer"],
  [Drawer, "DrawerViewportCssVariables", "drawer"],
  [Drawer, "DrawerViewportDataAttributes", "drawer"],
  [Drawer, "DrawerTriggerDataAttributes", "drawer"],
  [Drawer, "DrawerCloseDataAttributes", "drawer"],
  [Field, "FieldRootDataAttributes", "field"],
  [Field, "FieldLabelDataAttributes", "field"],
  [Field, "FieldErrorDataAttributes", "field"],
  [Field, "FieldDescriptionDataAttributes", "field"],
  [Field, "FieldControlDataAttributes", "field"],
  [Field, "FieldItemDataAttributes", "field"],
  [Fieldset, "FieldsetLegendDataAttributes", "fieldset"],
  [Input, "InputDataAttributes", "input"],
  [Menu, "MenuArrowDataAttributes", "menu"],
  [Menu, "MenuBackdropDataAttributes", "menu"],
  [Menu, "MenuCheckboxItemDataAttributes", "menu"],
  [Menu, "MenuCheckboxItemIndicatorDataAttributes", "menu"],
  [Menu, "MenuClearDataAttributes", "menu"],
  [Menu, "MenuInputDataAttributes", "menu"],
  [Menu, "MenuItemDataAttributes", "menu"],
  [Menu, "MenuLinkItemDataAttributes", "menu"],
  [Menu, "MenuPopupDataAttributes", "menu"],
  [Menu, "MenuPositionerCssVariables", "menu"],
  [Menu, "MenuPositionerDataAttributes", "menu"],
  [Menu, "MenuRadioItemDataAttributes", "menu"],
  [Menu, "MenuRadioItemIndicatorDataAttributes", "menu"],
  [Menu, "MenuTriggerDataAttributes", "menu"],
  [Menu, "MenuViewportCssVariables", "menu"],
  [Menu, "MenuViewportDataAttributes", "menu"],
  [Menu, "MenuSeparatorDataAttributes", "menu"],
  [Menu, "MenuSubmenuTriggerDataAttributes", "menu"],
  [NumberField, "NumberFieldRootDataAttributes", "number-field"],
  [NumberField, "NumberFieldGroupDataAttributes", "number-field"],
  [NumberField, "NumberFieldIncrementDataAttributes", "number-field"],
  [NumberField, "NumberFieldDecrementDataAttributes", "number-field"],
  [NumberField, "NumberFieldInputDataAttributes", "number-field"],
  [NumberField, "NumberFieldScrubAreaDataAttributes", "number-field"],
  [NumberField, "NumberFieldScrubAreaCursorDataAttributes", "number-field"],
  [OTPField, "OTPFieldRootDataAttributes", "otp-field"],
  [OTPField, "OTPFieldInputDataAttributes", "otp-field"],
  [OTPField, "OTPFieldSeparatorDataAttributes", "otp-field"],
  [Popover, "PopoverTriggerDataAttributes", "popover"],
  [Popover, "PopoverPositionerCssVariables", "popover"],
  [Popover, "PopoverPositionerDataAttributes", "popover"],
  [Popover, "PopoverPopupCssVariables", "popover"],
  [Popover, "PopoverPopupDataAttributes", "popover"],
  [Popover, "PopoverArrowDataAttributes", "popover"],
  [Popover, "PopoverBackdropDataAttributes", "popover"],
  [Popover, "PopoverViewportCssVariables", "popover"],
  [Popover, "PopoverViewportDataAttributes", "popover"],
  [PreviewCard, "PreviewCardTriggerDataAttributes", "preview-card"],
  [PreviewCard, "PreviewCardPositionerCssVariables", "preview-card"],
  [PreviewCard, "PreviewCardPositionerDataAttributes", "preview-card"],
  [PreviewCard, "PreviewCardPopupDataAttributes", "preview-card"],
  [PreviewCard, "PreviewCardArrowDataAttributes", "preview-card"],
  [PreviewCard, "PreviewCardBackdropDataAttributes", "preview-card"],
  [PreviewCard, "PreviewCardViewportCssVariables", "preview-card"],
  [PreviewCard, "PreviewCardViewportDataAttributes", "preview-card"],
  [Radio, "RadioRootDataAttributes", "radio"],
  [Radio, "RadioIndicatorDataAttributes", "radio"],
  [RadioGroup, "RadioGroupDataAttributes", "radio-group"],
  [ScrollArea, "ScrollAreaRootCssVariables", "scroll-area"],
  [ScrollArea, "ScrollAreaRootDataAttributes", "scroll-area"],
  [ScrollArea, "ScrollAreaViewportCssVariables", "scroll-area"],
  [ScrollArea, "ScrollAreaViewportDataAttributes", "scroll-area"],
  [ScrollArea, "ScrollAreaScrollbarCssVariables", "scroll-area"],
  [ScrollArea, "ScrollAreaScrollbarDataAttributes", "scroll-area"],
  [ScrollArea, "ScrollAreaContentDataAttributes", "scroll-area"],
  [ScrollArea, "ScrollAreaThumbDataAttributes", "scroll-area"],
  [Select, "SelectTriggerDataAttributes", "select"],
  [Select, "SelectValueDataAttributes", "select"],
  [Select, "SelectIconDataAttributes", "select"],
  [Select, "SelectBackdropDataAttributes", "select"],
  [Select, "SelectPositionerCssVariables", "select"],
  [Select, "SelectPositionerDataAttributes", "select"],
  [Select, "SelectPopupDataAttributes", "select"],
  [Select, "SelectItemDataAttributes", "select"],
  [Select, "SelectItemIndicatorDataAttributes", "select"],
  [Select, "SelectArrowDataAttributes", "select"],
  [Select, "SelectScrollDownArrowDataAttributes", "select"],
  [Select, "SelectScrollUpArrowDataAttributes", "select"],
  [Select, "SelectSeparatorDataAttributes", "select"],
  [Separator, "SeparatorDataAttributes", "separator"],
  [Slider, "SliderRootDataAttributes", "slider"],
  [Slider, "SliderValueDataAttributes", "slider"],
  [Slider, "SliderControlDataAttributes", "slider"],
  [Slider, "SliderTrackDataAttributes", "slider"],
  [Slider, "SliderThumbDataAttributes", "slider"],
  [Slider, "SliderIndicatorDataAttributes", "slider"],
  [Switch, "SwitchRootDataAttributes", "switch"],
  [Switch, "SwitchThumbDataAttributes", "switch"],
  [Tabs, "TabsRootDataAttributes", "tabs"],
  [Tabs, "TabsTabDataAttributes", "tabs"],
  [Tabs, "TabsIndicatorCssVariables", "tabs"],
  [Tabs, "TabsIndicatorDataAttributes", "tabs"],
  [Tabs, "TabsPanelDataAttributes", "tabs"],
  [Tabs, "TabsListDataAttributes", "tabs"],
  [Toast, "ToastViewportCssVariables", "toast"],
  [Toast, "ToastViewportDataAttributes", "toast"],
  [Toast, "ToastRootCssVariables", "toast"],
  [Toast, "ToastRootDataAttributes", "toast"],
  [Toast, "ToastContentDataAttributes", "toast"],
  [Toast, "ToastDescriptionDataAttributes", "toast"],
  [Toast, "ToastTitleDataAttributes", "toast"],
  [Toast, "ToastCloseDataAttributes", "toast"],
  [Toast, "ToastActionDataAttributes", "toast"],
  [Toast, "ToastPositionerCssVariables", "toast"],
  [Toast, "ToastPositionerDataAttributes", "toast"],
  [Toast, "ToastArrowDataAttributes", "toast"],
  [Toggle, "ToggleDataAttributes", "toggle"],
  [ToggleGroup, "ToggleGroupDataAttributes", "toggle-group"],
  [Tooltip, "TooltipTriggerDataAttributes", "tooltip"],
  [Tooltip, "TooltipPositionerCssVariables", "tooltip"],
  [Tooltip, "TooltipPositionerDataAttributes", "tooltip"],
  [Tooltip, "TooltipPopupDataAttributes", "tooltip"],
  [Tooltip, "TooltipArrowDataAttributes", "tooltip"],
  [Tooltip, "TooltipViewportCssVariables", "tooltip"],
  [Tooltip, "TooltipViewportDataAttributes", "tooltip"],
  [Progress, "ProgressRootDataAttributes", "progress"],
  [Progress, "ProgressTrackDataAttributes", "progress"],
  [Progress, "ProgressIndicatorDataAttributes", "progress"],
  [Progress, "ProgressValueDataAttributes", "progress"],
  [Progress, "ProgressLabelDataAttributes", "progress"],
  [Toolbar, "ToolbarSeparatorDataAttributes", "toolbar"],
  [Toolbar, "ToolbarRootDataAttributes", "toolbar"],
  [Toolbar, "ToolbarGroupDataAttributes", "toolbar"],
  [Toolbar, "ToolbarButtonDataAttributes", "toolbar"],
  [Toolbar, "ToolbarLinkDataAttributes", "toolbar"],
  [Toolbar, "ToolbarInputDataAttributes", "toolbar"],
  [ContextMenu, "ContextMenuTriggerDataAttributes", "context-menu"],
  [ContextMenu, "ContextMenuPositionerDataAttributes", "context-menu"],
  [ContextMenu, "ContextMenuPositionerCssVariables", "context-menu"],

  [Autocomplete, "AutocompleteTriggerDataAttributes", "autocomplete"],
  [Autocomplete, "AutocompleteInputDataAttributes", "autocomplete"],
  [Autocomplete, "AutocompleteInputGroupDataAttributes", "autocomplete"],
  [Autocomplete, "AutocompleteClearDataAttributes", "autocomplete"],
  [Autocomplete, "AutocompleteBackdropDataAttributes", "autocomplete"],
  [Autocomplete, "AutocompletePositionerCssVariables", "autocomplete"],
  [Autocomplete, "AutocompletePositionerDataAttributes", "autocomplete"],
  [Autocomplete, "AutocompletePopupDataAttributes", "autocomplete"],
  [Autocomplete, "AutocompleteArrowDataAttributes", "autocomplete"],
  [Autocomplete, "AutocompleteItemDataAttributes", "autocomplete"],
  [Autocomplete, "AutocompleteSeparatorDataAttributes", "autocomplete"],
  [NavigationMenu, "NavigationMenuContentDataAttributes", "navigation-menu"],
  [NavigationMenu, "NavigationMenuTriggerDataAttributes", "navigation-menu"],
  [NavigationMenu, "NavigationMenuPositionerCssVariables", "navigation-menu"],
  [NavigationMenu, "NavigationMenuPositionerDataAttributes", "navigation-menu"],
  [NavigationMenu, "NavigationMenuBackdropDataAttributes", "navigation-menu"],
  [NavigationMenu, "NavigationMenuPopupCssVariables", "navigation-menu"],
  [NavigationMenu, "NavigationMenuPopupDataAttributes", "navigation-menu"],
  [NavigationMenu, "NavigationMenuArrowDataAttributes", "navigation-menu"],
  [NavigationMenu, "NavigationMenuLinkDataAttributes", "navigation-menu"],
  [NavigationMenu, "NavigationMenuIconDataAttributes", "navigation-menu"],
];

describe("metadata namespace exports (#5243)", () => {
  it("exposes every DataAttributes/CssVariables namespace from its component entrypoint", () => {
    expect(EXPECTED.length).toBe(196);

    for (const [module, name, component] of EXPECTED) {
      const namespace = module[name] as Record<string, unknown> | undefined;
      expect(namespace, `${component}: ${name} is exported`).toBeDefined();
      expect(typeof namespace, `${component}: ${name} is a namespace object`).toBe("object");

      const values = Object.values(namespace!);
      expect(values.length, `${component}: ${name} is non-empty`).toBeGreaterThan(0);

      const prefix = name.endsWith("CssVariables") ? "--" : "data-";
      for (const value of values) {
        expect(value, `${component}: ${name} value`).toEqual(expect.stringMatching(new RegExp(`^${prefix}`)));
      }
    }
  });

  it("exports the new DialogViewportDataAttributes constants", () => {
    expect({ ...Dialog.DialogViewportDataAttributes }).toEqual({
      open: "data-open",
      closed: "data-closed",
      startingStyle: "data-starting-style",
      endingStyle: "data-ending-style",
      nested: "data-nested",
      nestedDialogOpen: "data-nested-dialog-open",
    });
  });

  it("exports the new AlertDialogTriggerDataAttributes constants", () => {
    expect({ ...AlertDialog.AlertDialogTriggerDataAttributes }).toEqual({
      disabled: "data-disabled",
      popupOpen: "data-popup-open",
    });
  });

  it("aliases shared metadata namespaces to the same values", () => {
    expect({ ...AlertDialog.AlertDialogViewportDataAttributes }).toEqual({ ...Dialog.DialogViewportDataAttributes });
    expect({ ...Drawer.DrawerTriggerDataAttributes }).toEqual({ ...Dialog.DialogTriggerDataAttributes });
    expect({ ...Drawer.DrawerCloseDataAttributes }).toEqual({ ...Dialog.DialogCloseDataAttributes });
    expect({ ...Combobox.ComboboxSeparatorDataAttributes }).toEqual({ ...Separator.SeparatorDataAttributes });
    expect({ ...Select.SelectSeparatorDataAttributes }).toEqual({ ...Separator.SeparatorDataAttributes });
    expect({ ...Menu.MenuSeparatorDataAttributes }).toEqual({ ...Separator.SeparatorDataAttributes });
    expect({ ...OTPField.OTPFieldSeparatorDataAttributes }).toEqual({ ...Separator.SeparatorDataAttributes });
  });
});
