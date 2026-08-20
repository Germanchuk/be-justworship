import type { Attribute, Schema } from '@strapi/strapi';

export interface ListInterludePoint extends Schema.Component {
  collectionName: 'components_list_interlude_points';
  info: {
    description: "\u041F\u0443\u043D\u043A\u0442 \u0441\u043B\u0443\u0436\u0456\u043D\u043D\u044F: \u043F\u0435\u0440\u0435\u0445\u0456\u0434 \u043C\u0456\u0436 \u043F\u0456\u0441\u043D\u044F\u043C\u0438, \u0449\u043E \u0437\u0432\u0443\u0447\u0438\u0442\u044C, \u043F\u043E\u043A\u0438 \u0433\u043E\u0432\u043E\u0440\u0438\u0442\u044C \u0432\u0435\u0434\u0443\u0447\u0438\u0439. \u041F\u043E\u0440\u043E\u0436\u043D\u0456\u0439 custom \u043E\u0437\u043D\u0430\u0447\u0430\u0454 \u00AB\u0440\u0430\u0445\u0443\u0432\u0430\u0442\u0438 \u0437\u0430 \u0441\u0443\u0441\u0456\u0434\u0430\u043C\u0438\u00BB \u2014 \u0441\u0430\u043C\u0435 \u0442\u043E\u043C\u0443 \u043F\u043E\u043B\u0435 \u043D\u0435 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u0435.";
    displayName: '\u041F\u0440\u043E\u0433\u0440\u0430\u0448';
    icon: 'seed';
  };
  attributes: {
    custom: Attribute.Text;
  };
}

export interface ListNotePoint extends Schema.Component {
  collectionName: 'components_list_note_points';
  info: {
    description: '\u041F\u0443\u043D\u043A\u0442 \u0441\u043B\u0443\u0436\u0456\u043D\u043D\u044F: \u0440\u044F\u0434\u043E\u043A \u0442\u0435\u043A\u0441\u0442\u0443 \u0434\u043B\u044F \u0433\u0443\u0440\u0442\u0443 (\u00AB\u043F\u0456\u0441\u043B\u044F \u0446\u0456\u0454\u0457 \u2014 \u043C\u043E\u043B\u0438\u0442\u0432\u0430\u00BB). \u041D\u0430\u043B\u0435\u0436\u0438\u0442\u044C \u043B\u0438\u0448\u0435 \u0446\u044C\u043E\u043C\u0443 \u0441\u043F\u0438\u0441\u043A\u0443. \u041E\u0437\u043D\u0430\u043A\u0430 \u00AB\u0437\u0432\u0443\u0447\u0438\u0442\u044C\u00BB \u0440\u043E\u0431\u0438\u0442\u044C \u043F\u0440\u0438\u043C\u0456\u0442\u043A\u0443 \u043F\u0440\u043E\u0433\u0440\u0430\u0448\u0435\u043C: \u0443 \u0437\u0456\u0431\u0440\u0430\u043D\u043D\u0456 \u043F\u0456\u0434 \u043D\u0435\u0457 \u043A\u0440\u0443\u0442\u0438\u0442\u044C\u0441\u044F \u043B\u0443\u043F, \u0430 \u0441\u0430\u043C \u0442\u0435\u043A\u0441\u0442 \u0441\u0442\u0430\u0454 \u0439\u043E\u0433\u043E \u043F\u0456\u0434\u043F\u0438\u0441\u043E\u043C. \u0422\u0440\u0435\u0442\u044C\u043E\u0433\u043E \u0442\u0438\u043F\u0443 \u043F\u0443\u043D\u043A\u0442\u0443 \u043D\u0435\u043C\u0430\u0454 \u2014 \u043F\u0440\u043E\u0433\u0440\u0430\u0448 \u0446\u0435 \u0441\u0430\u043C\u0435 \u0446\u044F \u043E\u0437\u043D\u0430\u043A\u0430.';
    displayName: '\u041F\u0440\u0438\u043C\u0456\u0442\u043A\u0430';
    icon: 'message';
  };
  attributes: {
    sounding: Attribute.Boolean & Attribute.DefaultTo<false>;
    text: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        maxLength: 200;
        minLength: 1;
      }>;
  };
}

export interface ListSongPoint extends Schema.Component {
  collectionName: 'components_list_song_points';
  info: {
    description: '\u041F\u0443\u043D\u043A\u0442 \u0441\u043B\u0443\u0436\u0456\u043D\u043D\u044F: \u043F\u0456\u0441\u043D\u044F \u0437 \u0431\u0456\u0431\u043B\u0456\u043E\u0442\u0435\u043A\u0438 \u0433\u0443\u0440\u0442\u0443. \u041F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u2014 \u0441\u043F\u0440\u0430\u0432\u0436\u043D\u044F \u0440\u0435\u043B\u044F\u0446\u0456\u044F, \u0442\u043E\u0436 \u043F\u0435\u0440\u0435\u0439\u043C\u0435\u043D\u0443\u0432\u0430\u043D\u043D\u044F \u043F\u0456\u0434\u0445\u043E\u043F\u043B\u044E\u0454\u0442\u044C\u0441\u044F \u0441\u0430\u043C\u0435 \u0441\u043E\u0431\u043E\u044E.';
    displayName: '\u041F\u0456\u0441\u043D\u044F';
    icon: 'music';
  };
  attributes: {
    song: Attribute.Relation<'list.song-point', 'oneToOne', 'api::song.song'>;
  };
}

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
      'list.interlude-point': ListInterludePoint;
      'list.note-point': ListNotePoint;
      'list.song-point': ListSongPoint;
      'song.song-section': SongSongSection;
      'user-preferences.preferences': UserPreferencesPreferences;
    }
  }
}
