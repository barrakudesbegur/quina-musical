import {
  Document,
  Font,
  Page,
  Path,
  render,
  StyleSheet,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer'
import { Style } from '@react-pdf/types'
import { chunk } from 'lodash'
import { join } from 'path'
import React from 'react'
import { QuinaCard } from './generate-cards-json'

////////////////////////////////////////////////////////////////////////////////
// 1) Register Fonts
////////////////////////////////////////////////////////////////////////////////
const fontPath = join(__dirname, 'assets/LondrinaSolid')
Font.register({
  family: 'LondrinaSolid',
  fonts: [
    {
      src: join(fontPath, 'LondrinaSolid-Regular.ttf'),
      fontWeight: 'normal',
    },
    {
      src: join(fontPath, 'LondrinaSolid-Light.ttf'),
      fontWeight: 'light',
    },
  ],
})

////////////////////////////////////////////////////////////////////////////////
// 2) Define Styles
////////////////////////////////////////////////////////////////////////////////
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    flexGrow: 1,
  },
  cardContainer: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    padding: 20,
    fontFamily: 'LondrinaSolid',
    flexGrow: 1,
    lineHeight: 0.8,
    gap: 20,
  },
  headerRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 25,
  },
  headerLeft: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 3,
    height: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },

  headerLogoWrapper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 4,
  },
  headerLogoIcon: {
    height: 23,
    width: 17,
  },
  headerLogoTextWrapper: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    lineHeight: 0.7,
    gap: 4,
  },
  headerLogoTopText: {
    fontSize: 16,
    fontWeight: 'light',
    letterSpacing: 1.08,
  },
  headerLogoBottomText: {
    fontSize: 9,
    fontWeight: 'light',
    letterSpacing: 1.08,
    color: '#4d4d4d',
  },

  cardTitle: {
    fontSize: 36,
    height: '100%',
    fontWeight: 'normal',
    textAlign: 'center',
    marginTop: -21,
  },
  cardNumber: {
    fontSize: 14,
    fontWeight: 'light',
    textAlign: 'right',
    lineHeight: 1,
  },

  table: {
    flex: 1,
    border: '1 solid black',
    padding: 1,
  },
  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    flex: 1,
  },
  tableCell: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 4,
    border: '1 solid black',
    margin: -0.5,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 5,
    paddingRight: 5,
    overflow: 'hidden',
  },
  songTitle: {
    fontSize: 16,
    fontWeight: 'normal',
    textTransform: 'uppercase',
    maxLines: 2,
    textOverflow: 'ellipsis',
    letterSpacing: 1.07,
    lineHeight: 0.9,
  },
  songArtist: {
    fontSize: 13,
    fontWeight: 'light',
    letterSpacing: 1.16,
    maxLines: 2,
    textOverflow: 'ellipsis',
    lineHeight: 0.8,
    color: '#4d4d4d',
  },

  logoStamp: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 70,
    height: 70,
    transform: 'rotate(15deg)',
  },
})

////////////////////////////////////////////////////////////////////////////////
// 3) Quina Card Component
////////////////////////////////////////////////////////////////////////////////

const QuinaCardComponent: React.FC<{
  card: QuinaCard
  style?: Style
}> = ({ card, style }) => {
  return (
    <View style={style ? [styles.cardContainer, style] : styles.cardContainer}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.headerLogoWrapper}>
            <Svg
              viewBox="0 0 512 683"
              fill="currentColor"
              style={styles.headerLogoIcon}
            >
              <Path d="M194.56 10.351c-33.465 1.404-41.817 2.168-47.904 4.378-9.445 3.429-32.764 19.208-44.942 30.411-11.842 10.892-15.679 15.61-17.767 21.847-.786 2.346-3.271 8.298-5.522 13.226-4.969 10.876-6.046 15.314-6.007 24.747.138 33.433 5.008 51.269 18.334 67.151 7.94 9.463 12.464 13.566 21.461 19.465 10.318 6.765 19.884 17.655 25.099 28.574l3.061 6.41V256.427l-4.693 9.898-4.693 9.899-7.68 3.901c-4.224 2.147-10.56 5.135-14.08 6.642-3.52 1.507-12.079 5.579-19.021 9.048-6.941 3.47-15.581 7.484-19.2 8.92-3.618 1.435-11.187 4.827-16.819 7.538a2899.085 2899.085 0 0 1-15.037 7.189c-7.07 3.335-11.883 8.035-21.793 21.28C4.087 358.478 2.137 363.104.739 380.16c-1.488 18.149.019 26.183 6.233 33.243 4.107 4.666 12.499 9.817 21.219 13.024 6.3 2.317 6.597 2.342 27.276 2.345 19.134.003 21.594-.168 29.013-2.014 4.459-1.11 11.563-3.546 15.787-5.413 16.437-7.265 17.536-7.652 18.792-6.61 2.516 2.089 5.474 8.476 6.544 14.13.776 4.105 1.114 14.244 1.107 33.215-.012 30.706-.434 33.833-6.076 45.008-1.719 3.405-4.79 10.71-6.825 16.232-2.034 5.522-4.344 11.282-5.132 12.8-.788 1.518-3.845 9.096-6.793 16.84a3032.75 3032.75 0 0 1-9.723 25.173c-5.52 14.036-9.785 29.361-11.118 39.945-1.407 11.178-.705 27.869 1.402 33.375 2.171 5.669 8.881 12.848 14.804 15.838 8.892 4.489 13.885 5.527 26.484 5.508 13.407-.021 17.311-1.101 27.269-7.543 8.611-5.57 12.841-10.284 17.058-19.008 2.002-4.14 7.146-13.864 11.431-21.608 9.985-18.041 15.391-30.728 21.381-50.177 2.891-9.389 6.517-19.02 9.092-24.15 2.355-4.693 5.056-10.53 6.001-12.97 2.955-7.623 12.141-25.584 14.473-28.298 1.225-1.425 3.404-4.328 4.842-6.451 1.439-2.123 4.376-5.483 6.528-7.467 4.071-3.752 12.879-8.618 13.848-7.649.306.306.891 8.733 1.301 18.726.41 9.993 1.538 27.385 2.507 38.649.969 11.264 2.101 28.544 2.515 38.4.813 19.333 2.143 26.931 6.503 37.142 3.708 8.686 11.387 21.026 16.684 26.814 15.338 16.756 49.07 30.908 66.707 27.985 6.023-.998 17.591-5.813 23.27-9.686 8.687-5.925 15.747-17.103 19.113-30.262 1.053-4.119 2.029-12.094 2.545-20.803.461-7.768 1.192-17.003 1.624-20.523.432-3.52.797-17.126.812-30.236.024-22.143-.122-24.523-2.062-33.493-1.148-5.311-3.255-19.146-4.681-30.744-1.426-11.598-2.918-22.446-3.315-24.107-1.644-6.874-5.451-19.673-7.753-26.06-1.353-3.755-3.037-9.367-3.744-12.471-.706-3.104-2.838-9.781-4.737-14.836-4.61-12.275-5.715-18.453-4.438-24.812.542-2.702.986-7.996.986-11.766 0-11.791 5.086-25.965 12.271-34.199 2.481-2.843 6.861-8.625 9.734-12.849 6.148-9.041 8.491-12.075 8.887-11.508.159.228 1.12 2.196 2.135 4.373 3.012 6.46 6.634 9.944 11.939 11.486 5.487 1.595 9.406.914 17.211-2.991 2.646-1.323 6.346-2.674 8.223-3.001 1.878-.328 7.446-1.679 12.374-3.004 4.928-1.324 11.786-2.843 15.24-3.375 6.212-.957 28.024-7.639 32.973-10.101 8.649-4.304 12.697-13.27 10.243-22.69-.706-2.709-1.288-6.731-1.293-8.938-.006-2.206-.592-6.123-1.304-8.705-2.852-10.35-9.74-41.287-11.461-51.477-1.006-5.957-2.575-13-3.487-15.651-.912-2.65-1.664-6.967-1.671-9.592-.007-2.625-.542-7.077-1.189-9.893-.667-2.904-1.405-12.877-1.705-23.04-.94-31.836-3.05-54.809-5.563-60.587-1.936-4.45-6.879-8.727-10.925-9.454-1.77-.318-6.311-2.061-10.091-3.874-8.052-3.861-16.963-6.298-26.186-7.16l-6.605-.617-2.564-8.004c-3.098-9.673-4.117-14.081-5.166-22.359-.524-4.128-1.985-9.012-4.223-14.117-1.883-4.292-3.423-8.778-3.423-9.969 0-3.516-3.578-9.589-6.708-11.387-3.407-1.955-9.107-2.073-12.596-.259-2.351 1.222-9.434 8.773-14.158 15.094-3.56 4.763-13.289 22.619-17.343 31.831-2.047 4.65-5.297 11.062-7.222 14.249-6.022 9.966-6.435 15.39-1.594 20.904 4.962 5.652 12.748 5.634 17.729-.039 1.451-1.653 2.638-3.604 2.638-4.337 0-.732.809-2.468 1.798-3.857 2.023-2.841 6.602-12.033 9.631-19.336 3.112-7.503 10.612-20.345 11.047-18.915.21.693.841 4.515 1.401 8.493.559 3.979 2.328 11.558 3.93 16.844 1.602 5.286 2.913 9.969 2.913 10.409 0 .439-4.896 3.378-10.88 6.53-14.437 7.606-20.919 11.957-27.483 18.447-10.61 10.489-17.957 25.219-17.957 36.005 0 5.055 4.203 20.091 7.361 26.336 1.125 2.225 2.621 6.781 3.325 10.126.704 3.345 2.427 8.814 3.83 12.153 1.403 3.339 2.551 6.481 2.551 6.983 0 .502-2.347 1.397-5.216 1.99-2.869.592-7.223 1.965-9.676 3.049-7.221 3.194-34.865 19.571-48.57 28.775-12.113 8.135-12.801 8.476-15.16 7.499-2.418-1.002-2.461-1.132-2.053-6.248.23-2.874.634-9.393.899-14.487.559-10.764 1.8-13.813 11.51-28.286 11.303-16.846 33.342-51.032 36.238-56.211 8.39-15.003 10.679-26.009 11.295-54.294.678-31.189-1.429-43.726-9.339-55.571-4.291-6.427-7.564-8.845-21.326-15.764-19.625-9.866-30.34-11.503-74.017-11.305-16.206.073-36.953.447-46.105.831m76.8 31.53c14.157 1.298 17.699 2.22 28.373 7.391 13.64 6.608 13.014 4.79 13.014 37.768 0 27.101-.349 30.073-4.658 39.68-2.094 4.67-23.849 38.836-38.034 59.733-6.688 9.853-12.605 21.695-14.448 28.918-1.842 7.221-2.817 40.751-1.319 45.347 1.685 5.166 5.492 10.17 11.344 14.911 7.788 6.309 12.722 7.989 23.648 8.052 8.298.048 9.37-.142 14.507-2.579 3.05-1.448 8.81-4.967 12.8-7.821 3.989-2.853 12.629-8.413 19.2-12.355 28.454-17.068 32.121-18.694 39.186-17.368 2.781.521 3.129.929 4.276 5.012.687 2.444 1.509 6.363 1.826 8.71.317 2.347 2.065 8.989 3.884 14.761 1.819 5.772 3.308 11.224 3.308 12.116 0 2.735-7.954 16.438-12.983 22.366-2.617 3.085-6.778 8.628-9.246 12.317-2.467 3.689-6.464 9.011-8.882 11.827-6.39 7.441-8.026 10.015-11.302 17.778-5.564 13.186-7.943 22.933-8.992 36.835-1.695 22.46-.979 27.98 6.477 49.92 1.675 4.928 4.819 14.72 6.987 21.76 2.168 7.04 4.688 15.104 5.601 17.92.913 2.816 2.979 15.488 4.592 28.16 1.613 12.672 3.592 25.728 4.397 29.013 1.843 7.518 2.682 52.425 1.175 62.893-.52 3.615-1.271 12.255-1.668 19.2-.765 13.37-2.604 20.627-6.007 23.706-2.665 2.412-10.187 5.561-13.283 5.561-6.83 0-23.494-7.24-32.533-14.134-5.953-4.54-14.622-19.071-16.837-28.222-.666-2.752-1.436-11.744-1.71-19.981-.274-8.238-1.284-23.982-2.243-34.987-.959-11.005-2.088-28.457-2.509-38.782-.835-20.518-1.722-27.869-4.369-36.197-2.304-7.25-5.904-12.303-10.826-15.197-3.716-2.184-4.716-2.365-12.986-2.352-8.382.014-9.449.218-16.547 3.174-16.383 6.824-27.26 15.686-38.815 31.625-5.012 6.915-16.945 28.892-18.394 33.88-.342 1.173-3.251 7.701-6.466 14.507-3.785 8.012-7.527 17.861-10.616 27.944-5.845 19.077-9.178 26.865-19.565 45.708-4.447 8.067-9.169 16.952-10.495 19.744-1.608 3.391-3.635 6.013-6.102 7.894-3.454 2.634-4.127 2.816-10.397 2.816-3.688 0-7.74-.393-9.005-.874l-2.299-.874.459-11.286c.554-13.609 2.325-20.599 10.456-41.287 3.107-7.904 7.204-18.596 9.104-23.759 1.9-5.162 4.319-11.114 5.375-13.226 1.057-2.112 3.361-7.872 5.122-12.8 1.761-4.928 4.643-11.84 6.405-15.36 3.969-7.929 7.203-18.049 8.453-26.454.523-3.52 1.011-18.688 1.084-33.706.144-29.654-.732-38.591-4.864-49.599-4.548-12.115-13.44-22.439-24.051-27.923-3.543-1.832-15.138-1.887-21.979-.105-2.759.718-9.464 3.392-14.9 5.942-14.222 6.67-18.743 7.6-37.19 7.646-14.157.036-15.684-.111-19.507-1.875l-4.147-1.913.601-9.607c.707-11.292 1.075-12.116 11.407-25.581l7.019-9.148 10.847-5.235c5.966-2.879 15.263-7.072 20.66-9.318 5.398-2.245 16.778-7.485 25.29-11.643 8.512-4.159 21.329-10.249 28.482-13.535 14.936-6.859 18.617-9.832 22.721-18.346 13.02-27.012 13.958-29.969 13.942-43.947-.024-20.624-2.313-32.101-8.889-44.563-6.921-13.119-21.516-29.164-33.904-37.274-7.785-5.096-17.178-14.802-20.358-21.034-2.569-5.036-3.93-12.574-5.086-28.179l-1.048-14.143 4.306-9.75c2.368-5.363 4.565-10.814 4.882-12.114.926-3.8 15.646-16.839 29.032-25.717 6.606-4.381 12.938-8.462 14.071-9.068 1.34-.718 8.323-1.367 19.99-1.86 9.861-.416 23.689-1.034 30.729-1.374 19.719-.951 54.463-.996 64.427-.083m-44.373 24.137c-10.02 2.331-16.624 6.78-19.938 13.431-2.024 4.062-2.255 5.498-2.308 14.372l-.06 9.859-1.298-4.267c-1.752-5.762-4.357-8.969-9.605-11.825-8.693-4.732-15.9-6.632-26.994-7.118-9.33-.41-10.692-.275-14.712 1.455-11.581 4.981-17.88 20.703-17.094 42.662.283 7.897.608 9.483 2.742 13.369 6.999 12.747 20.715 19.267 34.828 16.556 12.152-2.334 24.763-10.797 29.227-19.612 2.561-5.059 4.717-12.369 4.786-16.228.048-2.729.136-2.842.841-1.083 1.747 4.352 6.208 9.648 10.012 11.884 3.974 2.337 4.212 2.367 18.552 2.367h14.525l5.675-2.794c7.105-3.498 13.516-10.263 15.987-16.868 2.375-6.346 2.403-16.927.065-24.496-2.844-9.208-10.704-16.472-21.765-20.116-6.794-2.238-17.472-2.943-23.466-1.548m16.84 24.574c4.073 1.237 6.2 4.423 6.2 9.287 0 3.504-.369 4.386-2.626 6.285-2.394 2.015-3.294 2.209-10.224 2.209-8.961 0-8.706.341-8.309-11.087l.252-7.247 2.56-.532c2.921-.607 8.104-.144 12.147 1.085m-69.259 14.916c5.778 1.924 6.045 2.232 7.088 8.153.801 4.551.712 5.688-.698 8.876-1.288 2.911-2.545 4.131-6.168 5.985-6.129 3.138-12.167 3.254-14.578.282-1.524-1.879-1.634-2.882-1.118-10.191.315-4.458.95-9.546 1.412-11.306.837-3.188.857-3.2 5.348-3.2 2.48 0 6.401.63 8.714 1.401m266.664 17.026c2.549.749 6.498 2.368 8.776 3.597 4.025 2.173 4.129 2.327 3.703 5.499-.53 3.953-1.068 4.635-7.901 10.005l-5.375 4.223-.529-4.875c-.519-4.79-2.801-16.592-3.619-18.725-.52-1.354-.629-1.36 4.945.276m-27.114 10.799c.747 3.403 1.577 9.885 1.844 14.405.472 8.003.434 8.231-1.445 8.735-3.805 1.019-18.972.529-23.186-.749-2.304-.699-5.257-1.271-6.563-1.271s-2.604-.372-2.886-.828c-1.204-1.949 5.051-10.486 11.186-15.266 3.531-2.751 17.843-11.094 19.178-11.18.282-.018 1.124 2.752 1.872 6.154m44.017 63.36c.467 2.347 1.104 7.339 1.416 11.094.312 3.754 1.434 9.514 2.493 12.8 1.059 3.285 2.403 9.237 2.987 13.226.961 6.57 8.869 42.65 11.409 52.054.57 2.112.912 5.034.76 6.495-.262 2.508-.623 2.755-6.547 4.476-3.449 1.002-9.269 2.239-12.933 2.749-3.665.51-9.559 1.831-13.098 2.935-8.93 2.787-15.441 3.877-15.853 2.654-.178-.53-.908-3.293-1.623-6.141-.714-2.849-1.863-6.777-2.552-8.73-1.11-3.146-1.1-4.356.086-10.608 1.736-9.143 1.13-22.09-1.366-29.182-2.382-6.77-8.218-15.967-14.442-22.759-4.555-4.971-5.381-6.461-7.787-14.045-1.48-4.666-3.844-11.556-5.253-15.311-4.082-10.874-4.054-10.159-.371-9.561 4.822.782 31.481-.956 38.375-2.503 7.716-1.731 13.574-4.505 18.431-8.728l3.84-3.339.589 9.079c.325 4.993.972 10.999 1.439 13.345" />
            </Svg>
            <View style={styles.headerLogoTextWrapper}>
              <Text style={styles.headerLogoTopText}>BARRAKUDES</Text>
              <Text style={styles.headerLogoBottomText}>JOVES • BEGUR</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.cardTitle}>QUINA QUINA!</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.cardNumber}>CARTRÓ {card.id}</Text>
        </View>
      </View>

      <View style={styles.table}>
        {card.lines.map((row) => (
          <View style={styles.tableRow} key={row.map((s) => s.id).join('-')}>
            {row.map((song) => (
              <View style={styles.tableCell} key={song.id}>
                <Text style={styles.songTitle}>{song.title}</Text>
                <Text style={styles.songArtist}>{song.artist}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      <Svg viewBox="0 0 1024 1024" fill="#000" style={styles.logoStamp}>
        <Path
          d="M424.96 56.316c-14.892.737-25.243 2.09-29.271 3.828-10.995 4.742-37.157 23.377-48.097 34.258-13.641 13.568-23.406 34.674-24.626 53.225-1.042 15.849 1.903 38.732 6.599 51.286 3.936 10.521 13.587 21.191 41.296 45.657 15.449 13.64 19.966 23.005 19.966 41.396 0 11.739-.781 15.653-4.955 24.838l-4.956 10.903-27.898 13.115a36695.375 36695.375 0 0 1-48.337 22.678c-23.36 10.93-25.087 12.29-38.678 30.477-12.653 16.931-15.652 26.576-14.856 47.784.642 17.132 2.53 21.324 12.776 28.367 11.199 7.699 21.702 10.327 41.162 10.3 20.94-.029 33.853-2.632 50.406-10.163 6.379-2.902 12.337-4.82 13.239-4.263.903.558 2.944 3.462 4.537 6.453 2.325 4.365 3.016 11.332 3.502 35.305.719 35.453 1.513 32.114-20.815 87.485-21.473 53.25-24.861 65.098-24.861 86.955 0 26.041 5.698 34.345 27.376 39.898 19.591 5.019 39.65.08 51.689-12.728 6.986-7.432 34.523-62.874 39.528-79.583 7.506-25.057 23.704-59.658 35.35-75.509 6.157-8.379 18.395-16.971 20.779-14.587.586.585 1.073 6.505 1.083 13.153.009 6.649.782 20.921 1.718 31.716.935 10.795 2.38 31.147 3.211 45.227 1.773 30.031 5.096 41.877 16.611 59.21 10.61 15.97 27.951 27.923 50.005 34.466 23.704 7.033 47.877-1.161 58.896-19.963 7.216-12.313 9.291-25.015 11.037-67.562 1.473-35.875 1.319-41.765-1.52-58.026-1.737-9.954-4.331-26.547-5.763-36.872-1.713-12.348-6.151-30.035-12.968-51.678l-10.364-32.905 1.587-16.867c1.672-17.761 5.827-30.012 12.77-37.643 2.135-2.347 7.508-9.451 11.941-15.787 4.433-6.336 8.706-11.52 9.496-11.52.789 0 1.902 1.861 2.473 4.135 1.584 6.312 9.086 14.26 14.602 15.472 3.196.702 7.848-.111 13.181-2.303 4.533-1.863 15.538-5.046 24.456-7.073 32.385-7.361 48.821-13.206 53.81-19.135 4.348-5.167 4.526-6.083 3.408-17.474-.649-6.612-3.089-20.086-5.422-29.942-10.796-45.616-14.532-68.916-16.142-100.693-2.65-52.276-4.662-61.108-14.838-65.115-2.532-.997-6.071-2.582-7.866-3.523-7.656-4.012-22.553-8.162-29.298-8.162-8.39 0-8.536-.265-14.139-25.6-5.65-25.546-11.163-39.074-17.138-42.053-10.691-5.33-23.083 8.362-42.001 46.409-7.026 14.129-12.774 26.89-12.774 28.356 0 1.467 1.591 4.691 3.537 7.164 5.799 7.373 16.492 5.486 20.255-3.574 1.08-2.601 6.441-13.561 11.912-24.356l9.948-19.626 1.188 6.826c.653 3.755 2.67 11.938 4.48 18.185 1.811 6.247 3.293 11.776 3.293 12.287 0 .511-6.218 4.164-13.817 8.117-16.837 8.76-29.886 20.363-36.562 32.512-6.754 12.289-6.968 26.528-.638 42.393 2.435 6.101 5.746 15.317 7.36 20.48 1.613 5.162 3.268 10.167 3.677 11.121.41.954-4.17 3.023-10.178 4.599-10.447 2.74-36.704 17.035-59.402 32.339-14.315 9.653-15.027 9.288-15.027-7.698 0-16.849.783-18.603 23.483-52.605 34.128-51.12 35.375-54.568 35.388-97.836.01-33.318-1.032-38.93-9.548-51.397-6.536-9.569-27.697-20.607-45.644-23.807-13.948-2.488-71.801-2.865-114.612-.747m104.107 31.637c15.771 1.409 30.818 9.564 32.953 17.86 2.516 9.779.528 56.062-2.733 63.623-1.529 3.548-13.158 22.399-25.841 41.893-12.682 19.494-24.31 38.863-25.839 43.044-3.73 10.195-5.396 45.675-2.476 52.724 4.773 11.523 21.333 22.252 34.388 22.28 6.308.014 18.234-4.458 24.417-9.156 13.162-9.998 49.717-30.541 55.799-31.357 9.648-1.294 14.187 2.405 16.578 13.51 1.076 5.001 2.833 12.165 3.904 15.919 1.868 6.552 1.646 7.318-5.535 19.042-4.115 6.718-13.473 20.08-20.795 29.692-20.182 26.494-24.317 36.563-26.947 65.613-1.911 21.121-1.894 21.213 12.74 67.306 5.68 17.892 8.773 31.679 11.296 50.347 1.91 14.139 4.192 28.777 5.071 32.528 1.583 6.76-.569 78.04-2.68 88.752-1.44 7.31-5.034 12.32-11.079 15.446-4.892 2.53-6.034 2.476-16.624-.78-23.52-7.231-39.229-26.295-40.638-49.318-.384-6.285-1.47-22.198-2.412-35.363-.943-13.164-2.41-35.82-3.262-50.346-1.731-29.524-4.326-39.55-12.185-47.073-4.569-4.373-6.369-4.934-15.71-4.895-18.879.079-37.595 11.228-53.46 31.845-9.842 12.79-28.923 52.874-37.222 78.191-6.392 19.503-28.877 65.615-35.575 72.96-2.665 2.923-5.366 3.834-11.311 3.814-11.864-.04-12.243-.631-10.442-16.266 1.739-15.098 7.954-34.002 24.943-75.868 22.594-55.682 20.224-45.618 20.295-86.187.068-39.49-1.324-47.622-10.663-62.293-12.246-19.237-27.829-22.478-53.294-11.087-13.359 5.977-15.988 6.542-33.739 7.263-12.252.498-20.952.078-23.929-1.155-4.546-1.883-4.652-2.235-3.782-12.599.786-9.373 1.887-12.012 9.106-21.845 9.139-12.447 2.658-8.74 72.814-41.649 19.226-9.019 36.343-17.652 38.036-19.185 1.693-1.532 6.63-10.129 10.971-19.104 7.258-15.009 7.955-17.593 8.677-32.182.878-17.745-1.568-33.41-6.843-43.828-6.118-12.082-20.396-28.403-33.008-37.73-12.794-9.461-21.578-19.137-24.607-27.103-.982-2.583-2.256-12.485-2.83-22.006-.978-16.217-.752-18.01 3.59-28.403 2.588-6.193 7.773-14.372 11.739-18.515 7.878-8.23 29.442-23.49 36.837-26.068 4.479-1.561 91.313-4.658 104.24-3.717 3.285.239 10.965.881 17.067 1.426m-58.88 25.409c-10.335 4.632-16.088 14.045-16.25 26.585l-.054 4.266-2.909-4.69c-5.373-8.667-30.096-16.792-43.463-14.284-14.068 2.639-21.727 16.755-21.981 40.512-.129 11.971.397 14.468 4.284 20.341 16.537 24.989 62 12.576 65.431-17.866l.895-7.945 2.939 4.766c6.431 10.43 9.175 11.593 27.353 11.593 15.858 0 17.122-.27 23.964-5.12 10.585-7.502 13.878-14.584 13.183-28.347-.72-14.244-5.58-22.038-17.461-28.002-9.694-4.866-27.15-5.745-35.931-1.809m26.745 24.289c4.173 3.776 4.07 11.908-.18 14.182-1.815.972-6.423 1.767-10.24 1.767h-6.939v-18.773h7.119c4.23 0 8.386 1.146 10.24 2.824m-73.787 12.504c6.962 1.997 8.581 4.167 8.616 11.552.04 8.635-9.046 15.524-18.186 13.789-3.484-.661-5.057-11.325-3.161-21.431 1.146-6.112 3.032-6.691 12.731-3.91m279.203 19.571c8.298 3.467 8.059 9.199-.674 16.115l-6.592 5.221-.947-8.918c-.521-4.904-1.477-10.261-2.124-11.904-1.48-3.758 2.142-3.938 10.337-.514m-31.991 19.015.843 13.136-16.502-.863c-9.077-.475-16.953-1.313-17.502-1.862-1.849-1.849 6.147-12.613 12.61-16.976 10.188-6.877 16.51-9.68 18.178-8.059.842.819 1.91 7.399 2.373 14.624m-428.548 7.554c-9.269 2.783-35.343 25.166-49.178 42.218-17.292 21.312-51.533 82.9-67.643 121.666-15.757 37.917-27.423 101.441-25.468 138.682 1.455 27.73 5.696 59.941 8.642 65.638 7.376 14.263 29.344 8.333 29.022-7.835-.068-3.445-1.203-15.096-2.521-25.891-3.217-26.349-2.817-64.767.898-86.186 8.021-46.25 16.075-69.65 39.653-115.2 24.357-47.056 35.434-63.856 55.423-84.054 9.986-10.09 19.453-18.346 21.038-18.346 1.584 0 5.126-2.245 7.87-4.989 8.438-8.439 6.273-20.529-4.481-25.022-6.446-2.694-6.533-2.698-13.255-.681m534.104 24.951c-8.748 8.748-5.171 20.796 8.036 27.063 3.156 1.497 12.57 8.366 20.921 15.264 46.76 38.625 77.121 99.971 89.588 181.014 3.422 22.25 2.957 71.681-.895 95.081-3.781 22.967-2.963 26.946 6.458 31.439 7.415 3.535 14.258 1.497 19.137-5.699 6.081-8.972 10.152-40.649 9.934-77.301-.626-105.182-41.886-201.143-108.952-253.398-19.332-15.064-24.587-17.949-32.707-17.956-5.315-.005-8.114 1.087-11.52 4.493m-61.044 31.341c1.725 11.731 9.868 50.64 14.863 71.017 1.636 6.675 2.517 13.329 1.958 14.786-.606 1.58-5.022 3.486-10.94 4.722-5.458 1.14-15.633 3.468-22.611 5.174-13.674 3.341-15.472 3.123-15.472-1.87 0-1.787-1.536-7.147-3.414-11.909-2.232-5.663-3.413-12.684-3.413-20.289 0-13.438-1.838-19.602-9.728-32.618-3.129-5.163-7.577-15.317-9.884-22.565-2.308-7.248-5.327-15.888-6.711-19.2l-2.516-6.022h13.853c19.88 0 34.182-2.894 42.725-8.645l7.248-4.879 1.205 10.602c.663 5.831 1.939 15.594 2.837 21.696M154.453 617.165c-19.712 6.933-44.56 15.788-55.218 19.678l-19.378 7.073 1.045 6.533c1.862 11.643 10.59 35.145 16.435 44.253 7.431 11.581 13.588 15.259 25.543 15.259 11.45 0 17.248-3.222 27.34-15.19 7.336-8.701 7.392-8.729 15.378-7.67 17.303 2.296 38.149-8.854 42.802-22.894 3.11-9.382 2.153-22.448-2.562-34.974-5.116-13.591-11.529-25.113-13.838-24.86-.939.103-17.835 5.86-37.547 12.792m676.645.006c-10.51 9.83-17.46 23.882-17.614 35.608-.218 16.68 13.604 34.581 29.678 38.437 15.024 3.605 23.845-1.363 43.747-24.638 4.492-5.254 6.351-6.241 10.9-5.789 7.34.729 10.793 5.824 7.897 11.654-1.161 2.338-3.74 4.485-5.73 4.772-5.362.774-9.014 5.704-12.471 16.838-3.961 12.755-2.537 15.92 7.163 15.92 14.257 0 30.295-12.216 37.54-28.594 4.587-10.37 3.833-30.382-1.411-37.452-7.053-9.509-16.839-14.802-28.774-15.562-14.91-.949-23.433 3.328-37.14 18.638-11.035 12.324-14.294 13.811-18.965 8.649-5.569-6.153-2.405-11.713 7.853-13.801 4.894-.997 5.969-2.306 9.274-11.302 6.704-18.245 4.69-21.269-14.163-21.269-8.762 0-9.877.495-17.784 7.891m-652.306 32.23c.245 3.747-.244 7.868-1.086 9.159-2.359 3.615-10.167 2.783-14.809-1.577-6.246-5.868-5.362-9.449 3.076-12.459 10.501-3.745 12.3-3.061 12.819 4.877m-44.819 16.015c0 7.062-6.806 13.18-12.613 11.336-3.449-1.094-8.72-8.849-8.72-12.829 0-2.833 6.924-5.055 14.507-4.656 6.552.345 6.826.592 6.826 6.149m643.514 50.04c-10.85 16.157-19.727 30.672-19.727 32.255 0 3.628 29.944 25.806 82.542 61.135 13.063 8.774 13.506 8.93 16.55 5.845 1.72-1.744 11.973-15.459 22.783-30.478l19.654-27.306-7.998-7.254c-4.399-3.989-8.945-7.253-10.102-7.253s-7.856 7.224-14.885 16.054c-7.029 8.829-13.495 16.495-14.369 17.035-1.842 1.139-15.668-8.425-15.668-10.837 0-.891 1.92-4.45 4.266-7.908 2.347-3.458 4.267-7.303 4.267-8.545s-4.618-5.394-10.262-9.227l-10.262-6.969-5.353 8.612c-2.944 4.736-6.402 8.612-7.683 8.612-1.282 0-5.025-2.496-8.319-5.547l-5.989-5.547 8.592-13.345c13.115-20.373 14.313-23.079 11.65-26.315-3.38-4.107-15.253-12.393-17.756-12.393-1.212 0-11.081 13.219-21.931 29.376m-563.3-5.645c-22.704 8.724-54.207 22.569-74.627 32.798-18.833 9.434-18.738 9.144-8.058 24.667 5.851 8.504 8.155 9.017 19.217 4.275 17.718-7.595 20.459-4.225 8.954 11.013-4.229 5.6-7.709 11.376-7.734 12.835-.052 3.021 8.338 16.783 12.126 19.891 2.094 1.717 6.951-2.431 28.98-24.747 40.899-41.431 59.542-61.636 59.542-64.529 0-4.083-15.194-22.874-18.447-22.814-1.588.029-10.567 3.004-19.953 6.611m484.693 2.146c-4.992 2.748-14.507 12.044-14.507 14.171 0 1.008 7.274 9.076 16.164 17.93l16.164 16.096 4.314-4.052c3.696-3.473 3.985-4.437 2.015-6.744-5.362-6.281-5.003-6.958 3.1-5.848 6.216.852 8.508.427 11.294-2.094 3.304-2.99 3.331-3.283.496-5.356-1.649-1.206-4.823-2.193-7.052-2.193-7.274 0-10.655-3.022-10.655-9.525 0-11.064-11.552-17.771-21.333-12.385m-383.386 15.967c-12.133 11.844-15.838 13.662-14.152 6.944 1.462-5.824-5.074-12.501-9.027-9.222-2.327 1.929-7.302 11.523-7.302 14.08 0 .467 2.384 3.563 5.297 6.881 4.109 4.68 6.595 6.033 11.088 6.033 4.842 0 7.881-1.984 18.531-12.101 14.212-13.5 16.503-17.645 11.746-21.25-1.728-1.309-3.526-2.391-3.995-2.404-.469-.014-5.953 4.954-12.186 11.039m392.453-2.139c.679 3.527-4.248 5.903-6.848 3.303-2.601-2.6-.224-7.527 3.303-6.848 1.635.315 3.23 1.91 3.545 3.545m-34.371 11.167c-1.571 1.736-2.84 3.864-2.819 4.729.02.865 3.476 6.882 7.68 13.372 4.203 6.489 7.643 12.882 7.643 14.205 0 5.078-5.67.833-14.22-10.645-5.781-7.761-10.081-11.946-12.273-11.946-6.253 0-4.883 6.862 3.996 20.02 10.153 15.045 12.169 16.85 19.041 17.046 6.229.177 17.109-9.164 17.109-14.689 0-4.5-12.03-24.537-18.325-30.519-4.811-4.573-5.069-4.625-7.832-1.573m-339.926 5.633c-9.685 8.927-17.26 23.677-14.658 28.539 2.257 4.217 12.233 10.529 16.641 10.529 6.338 0 26.18-23.976 26.18-31.634 0-4.97-10.699-14.446-16.311-14.446-2.599 0-7.194 2.719-11.852 7.012m-134.297 5.828c-7.587 7.239-14.417 10.149-12.925 5.507.624-1.943 17.821-13.28 20.003-13.187.511.022-2.674 3.478-7.078 7.68m149.181 2.59c-.5 4.39-7.864 14.575-12.777 17.674-5.064 3.194-7.132-1.059-3.761-7.734 6.586-13.041 17.651-19.691 16.538-9.94m20.309 8.89c-1.699 3.99-5.229 13.702-7.843 21.584l-4.754 14.331 4.064 3.125c2.235 1.718 4.985 3.142 6.112 3.162 2.562.048 31.231-32.299 31.231-35.236 0-1.184-1.697-3.061-3.772-4.171-3.423-1.832-4.547-1.166-12.137 7.193-4.6 5.067-7.813 7.676-7.14 5.799 6.788-18.933 6.687-18.304 3.348-20.746-4.743-3.468-5.755-2.917-9.109 4.959m-133.49 37.547c-19.291 23.701-36.414 45.152-38.052 47.668l-2.979 4.576 9.933 7.842c13.734 10.844 17.152 11.481 22.635 4.217 2.4-3.178 6.839-8.483 9.864-11.788 5.41-5.91 5.501-5.938 5.535-1.742.018 2.347-1.497 10.652-3.368 18.455-1.87 7.804-3.401 14.874-3.401 15.713 0 2.467 23.611 20.821 25.379 19.729 1.816-1.122 6.639-26.39 8.496-44.51.962-9.382 1.762-11.775 3.728-11.148 1.377.439 7.496.788 13.597.775 13.957-.03 23.712-4.767 30.291-14.709 4.016-6.068 4.694-8.843 4.684-19.167-.01-10.172-.808-13.512-5.073-21.231-2.785-5.038-8.923-12.567-13.642-16.731-10.062-8.878-27.737-21.042-30.575-21.042-1.088 0-17.762 19.392-37.052 43.093m399.527-38.449c-12.959 4.87-14.801 12.356-7.065 28.709 8.989 19 18.902 23.389 29.678 13.139 5.59-5.317 5.988-11.069 1.299-18.759-3.879-6.363-8.028-7.025-13.292-2.121-4.171 3.886-3.35 8.521 1.509 8.521 1.777 0 3.231 1.152 3.231 2.56 0 1.408-1.473 2.56-3.274 2.56-3.788 0-9.863-8.938-11.442-16.836-1.057-5.284-.985-5.351 5.76-5.351 9.983 0 12.117-3.592 5.461-9.193-5.339-4.493-7.173-4.992-11.865-3.229m-231.011 14.471c-4.072 6.374-13.72 38.924-12.018 40.544 2.373 2.258 24.718 8.721 26.451 7.65 3.323-2.054 1.221-6.027-5.4-10.206-7.146-4.511-8.045-8.033-2.307-9.034 1.799-.314 4.203-1.765 5.341-3.225 1.67-2.142 1.422-3.478-1.28-6.913-1.842-2.342-3.349-4.923-3.349-5.735 0-1.972 7.257-1.877 12.631.166 3.268 1.243 4.957 1.005 6.938-.975 4.437-4.437 2.99-6.518-7.196-10.349-16.501-6.205-17.042-6.258-19.811-1.923m188.583 4.01c-10.511 4.773-10.411 3.29-1.826 27.015 7.729 21.361 6.911 20.771 22.105 15.955 11.477-3.637 12.716-4.451 12.299-8.084-.255-2.222-.64-4.217-.856-4.433-.216-.216-4.059.447-8.54 1.472-10.027 2.295-13.923-.022-9.065-5.39 3.976-4.393 2.872-9.16-2.409-10.407-6.861-1.62-6.082-5.874 1.72-9.393 8.015-3.614 8.925-4.632 7.49-8.373-1.51-3.933-10.141-3.257-20.918 1.638m126.055 2.571c-13.874 9.974-29.014 24.032-29.014 26.94 0 4.977 38.113 52.698 64.022 80.163l12.319 13.059 16.616-13.622c9.139-7.493 18.115-14.809 19.948-16.259 3.127-2.474 3.216-3.568 1.451-17.771-3.266-26.281-10.394-40.806-28.71-58.499-12.013-11.604-25.222-18.065-38.628-18.894-9.423-.583-10.995-.156-18.004 4.883m-277.89 8.974c-5.803 6.178-4.81 12.599 3.116 20.139 6.447 6.132 8.895 11.751 5.12 11.751-.938 0-3.242-1.536-5.12-3.414-4.13-4.13-11.946-4.615-11.946-.741 0 10.781 18.972 19.072 26.474 11.57 7.408-7.408 5.919-19.05-3.201-25.026-2.475-1.621-4.5-4.082-4.5-5.469 0-3.339.939-3.19 6.686 1.059 9.989 7.385 16.033.104 7.225-8.704-6.706-6.706-18.125-7.264-23.854-1.165m107.843-1.866c-.709 1.147-1.136 4.411-.949 7.253.608 9.255 5.674 37.562 6.961 38.893 1.747 1.809 18.787-1.639 23.561-4.767 4.508-2.954 5.257-10.077 1.616-15.35-1.279-1.852-2.703-7.406-3.165-12.344-1.185-12.673-4.496-15.769-16.861-15.769-5.936 0-10.389.831-11.163 2.084m-261.864 10.946c4.661 5.926 4.471 11.098-.584 15.847-4.622 4.342-7.812 3.922-15.156-1.994l-4.77-3.843 5.345-7.254c6.164-8.366 10.179-9.096 15.165-2.756m278.88 3.308c-.514 1.339-1.575 2.435-2.358 2.435-2.307 0-3.714-3.368-2.609-6.247.808-2.106 1.54-2.243 3.463-.647 1.341 1.113 2.018 3.119 1.504 4.459m189.209 13.743c7.495 3.811 13.74 13.449 14.561 22.471.818 8.983-2.348 15.26-6.829 13.54-3.774-1.448-26.844-30.507-26.844-33.813 0-1.509 1.728-3.57 3.84-4.58 4.102-1.96 7.9-1.368 15.272 2.382m-412.406 4.479c-30.856 74.633-41.999 102.81-41.573 105.12.629 3.413 15.128 10.616 23.676 11.762 6.131.823 6.182.777 10.128-9.174 2.182-5.501 5.145-12.306 6.586-15.122l2.62-5.12 1.27 6.827c.699 3.755 1.315 11.584 1.369 17.398.126 13.554 3.816 18.105 19.843 24.476l11.829 4.703.535-4.95c.295-2.722-.727-13.202-2.271-23.288a6264.718 6264.718 0 0 1-3.747-24.739l-.94-6.4h6.253c18.17 0 35.047-16.821 35.102-34.987.012-3.754-1.794-10.666-4.013-15.36-6.525-13.802-17.481-22.059-41.531-31.303-18.305-7.035-22.172-7.011-25.136.157m158.088-.854c.474 4.124 1.265 4.694 6.513 4.694s6.039-.57 6.513-4.694c.512-4.45.175-4.693-6.513-4.693s-7.025.243-6.513 4.693m67.1-.426c0 1.721-.96 3.449-2.134 3.84-1.351.45-2.133-.958-2.133-3.84 0-2.883.782-4.291 2.133-3.84 1.174.391 2.134 2.119 2.134 3.84m93.566 4.263c-3.92 1.743-7.951 4.709-8.958 6.59-1.983 3.705-1.16 6.283 17.581 55.112 5.278 13.753 9.597 26.114 9.597 27.469 0 1.355-1.581 3.894-3.513 5.643-2.691 2.435-4.189 2.754-6.4 1.361-4.014-2.527-15.449-24.482-26.98-51.798-5.349-12.672-11.105-24.52-12.792-26.329-3.022-3.241-3.245-3.218-15.091 1.551-6.613 2.662-12.024 5.074-12.024 5.361 0 1.708 30.113 73.37 34.636 82.423 7.237 14.489 11.928 17.787 26.432 18.587 21.753 1.2 41.603-10.512 46.31-27.325 1.925-6.876 1.759-9.417-1.422-21.685-3.699-14.273-19.246-55.69-25.522-67.991-6.706-13.144-9.7-14.373-21.854-8.969m-289.102 28.1c8.083 4.18 9.28 11.785 2.812 17.861-3.759 3.532-4.703 3.699-10.359 1.832-8.017-2.645-8.715-4.874-4.508-14.385 3.773-8.531 4.88-9.018 12.055-5.308m205.776-1.418a1030.04 1030.04 0 0 1-7.334 1.6c-2.997.642-5.774 4.748-11.787 17.427l-7.867 16.588-1.363-7.68c-.75-4.224-1.829-11.331-2.398-15.793-.922-7.221-1.446-8.028-4.77-7.343-2.054.423-8.259 1.263-13.789 1.866l-10.055 1.096 1.11 15.789c.999 14.213 7.973 76.01 10.664 94.496 1.852 12.721 5.748 14.011 26.406 8.747l6.123-1.561-2.246-14.942c-3.206-21.317-3.126-21.411 6.039-7.12 11.598 18.087 15.594 20.937 27.309 19.473 12.773-1.596 14.135-2.293 12.785-6.548-.628-1.977-8.34-15.074-17.139-29.105-11.768-18.765-15.718-26.448-14.939-29.056.582-1.95 4.863-13.717 9.512-26.149s8.598-24.72 8.776-27.307c.292-4.254-.248-4.729-5.651-4.971-3.285-.147-7.509.075-9.386.493m-134.986 27.396c-5.492 14.846-14.357 40.816-19.698 57.712-11.034 34.903-11.244 33.32 4.897 36.932 6.342 1.419 10.231 1.541 12.145.38 1.548-.939 5.318-6.893 8.377-13.232 7.207-14.932 10.866-14.981 12.933-.175 2.226 15.951 3.149 17.326 13.05 19.45 4.801 1.029 10.732 1.872 13.18 1.872h4.451l-1.115-28.272c-1.134-28.745-5.491-84.791-7.256-93.33-1.075-5.202-2.31-5.658-19.678-7.277l-11.299-1.052-9.987 26.992m20.688 30.832c-1.14 12.503-2.945 17.726-5.309 15.362-1.126-1.125 4.357-28.589 5.707-28.589.444 0 .265 5.952-.398 13.227"
          fill-rule="evenodd"
          fill="currentColor"
          opacity="0.09"
        />
      </Svg>
    </View>
  )
}

////////////////////////////////////////////////////////////////////////////////
// 4) The Main PDF Document
////////////////////////////////////////////////////////////////////////////////

const QuinaPDF: React.FC<{
  quinaCards: QuinaCard[]
}> = ({ quinaCards }) => {
  const chunkedCards = chunk(quinaCards, 3)

  return (
    <Document>
      {chunkedCards.map((threeCards) => (
        <Page
          size="A4"
          style={styles.page}
          key={threeCards.map((c) => c.id).join('-')}
        >
          {threeCards.map((card, index) => {
            const isLast = index === threeCards.length - 1
            return (
              <QuinaCardComponent
                card={card}
                style={{
                  borderBottom: isLast ? undefined : '1px dashed #f0f0f0',
                }}
                key={card.id}
              />
            )
          })}
        </Page>
      ))}
    </Document>
  )
  return
}

////////////////////////////////////////////////////////////////////////////////
// 5) Generate the PDF
////////////////////////////////////////////////////////////////////////////////

export function generateQuinaCardsPDF(data: QuinaCard[], outputPath: string) {
  render(<QuinaPDF quinaCards={data} />, outputPath)
}
