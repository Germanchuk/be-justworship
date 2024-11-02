import type { Schema, Attribute } from '@strapi/strapi';

export interface UserPreferencesPreferences extends Schema.Component {
  collectionName: 'components_user_preferences_preferences';
  info: {
    displayName: 'Preferences';
    icon: 'cog';
  };
  attributes: {
    defaultFontSize: Attribute.Integer &
      Attribute.SetMinMax<
        {
          min: 4;
          max: 64;
        },
        number
      > &
      Attribute.DefaultTo<16>;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'user-preferences.preferences': UserPreferencesPreferences;
    }
  }
}
