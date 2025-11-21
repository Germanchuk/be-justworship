import type { Attribute, Schema } from '@strapi/strapi';

export interface SongSongSection extends Schema.Component {
  collectionName: 'components_song_song_sections';
  info: {
    description: '';
    displayName: 'Song section';
    icon: 'chartBubble';
  };
  attributes: {
    content: Attribute.Text;
    spacing: Attribute.Integer;
  };
}

export interface UserPreferencesPreferences extends Schema.Component {
  collectionName: 'components_user_preferences_preferences';
  info: {
    description: '';
    displayName: 'Preferences';
    icon: 'cog';
  };
  attributes: {
    chordsFontSize: Attribute.Integer;
    lyricsFontSize: Attribute.Integer &
      Attribute.SetMinMax<
        {
          max: 64;
          min: 4;
        },
        number
      > &
      Attribute.DefaultTo<16>;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'song.song-section': SongSongSection;
      'user-preferences.preferences': UserPreferencesPreferences;
    }
  }
}
