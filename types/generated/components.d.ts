import type { Schema, Attribute } from '@strapi/strapi';

export interface UserPreferencesPreferences extends Schema.Component {
  collectionName: 'components_user_preferences_preferences';
  info: {
    displayName: 'Preferences';
    icon: 'cog';
    description: '';
  };
  attributes: {
    lyricsFontSize: Attribute.Integer &
      Attribute.SetMinMax<
        {
          min: 4;
          max: 64;
        },
        number
      > &
      Attribute.DefaultTo<16>;
    chordsFontSize: Attribute.Integer;
  };
}

export interface SongSongSection extends Schema.Component {
  collectionName: 'components_song_song_sections';
  info: {
    displayName: 'Song section';
    icon: 'chartBubble';
    description: '';
  };
  attributes: {
    content: Attribute.Text;
    spacing: Attribute.Integer;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'user-preferences.preferences': UserPreferencesPreferences;
      'song.song-section': SongSongSection;
    }
  }
}
