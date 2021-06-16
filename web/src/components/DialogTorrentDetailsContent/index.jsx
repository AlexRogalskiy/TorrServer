import { NoImageIcon } from 'icons'
import { humanizeSize } from 'utils/Utils'
import { useEffect, useState } from 'react'
import { Button, ButtonGroup } from '@material-ui/core'
import ptt from 'parse-torrent-title'
import axios from 'axios'
import { viewedHost } from 'utils/Hosts'
import { GETTING_INFO, IN_DB } from 'torrentStates'
import CircularProgress from '@material-ui/core/CircularProgress'
import { useTranslation } from 'react-i18next'

import { useUpdateCache, useGetSettings } from './customHooks'
import DialogHeader from './DialogHeader'
import TorrentCache from './TorrentCache'
import Table from './Table'
import DetailedView from './DetailedView'
import {
  DialogContentGrid,
  MainSection,
  Poster,
  SectionTitle,
  SectionSubName,
  WidgetWrapper,
  LoadingProgress,
  SectionHeader,
  CacheSection,
  TorrentFilesSection,
  Divider,
} from './style'
import { DownlodSpeedWidget, UploadSpeedWidget, PeersWidget, SizeWidget, StatusWidget } from './widgets'
import TorrentFunctions from './TorrentFunctions'
import { isFilePlayable } from './helpers'

const Loader = () => (
  <div style={{ minHeight: '80vh', display: 'grid', placeItems: 'center' }}>
    <CircularProgress />
  </div>
)

export default function DialogTorrentDetailsContent({ closeDialog, torrent }) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailedCacheView, setIsDetailedCacheView] = useState(false)
  const [viewedFileList, setViewedFileList] = useState()
  const [playableFileList, setPlayableFileList] = useState()
  const [seasonAmount, setSeasonAmount] = useState(null)
  const [selectedSeason, setSelectedSeason] = useState()

  const {
    poster,
    hash,
    title,
    name,
    stat,
    download_speed: downloadSpeed,
    upload_speed: uploadSpeed,
    torrent_size: torrentSize,
    file_stats: torrentFileList,
  } = torrent

  const cache = useUpdateCache(hash)
  const settings = useGetSettings(cache)

  const { Capacity, PiecesCount, PiecesLength, Filled } = cache

  useEffect(() => {
    if (playableFileList && seasonAmount === null) {
      const seasons = []
      playableFileList.forEach(({ path }) => {
        const currentSeason = ptt.parse(path).season
        if (currentSeason) {
          !seasons.includes(currentSeason) && seasons.push(currentSeason)
        }
      })
      seasons.length && setSelectedSeason(seasons[0])
      setSeasonAmount(seasons.sort((a, b) => a - b))
    }
  }, [playableFileList, seasonAmount])

  useEffect(() => {
    setPlayableFileList(torrentFileList?.filter(({ path }) => isFilePlayable(path)))
  }, [torrentFileList])

  useEffect(() => {
    const cacheLoaded = !!Object.entries(cache).length
    const torrentLoaded = stat !== GETTING_INFO && stat !== IN_DB

    if (!cacheLoaded && !isLoading) setIsLoading(true)
    if (cacheLoaded && isLoading && torrentLoaded) setIsLoading(false)
  }, [stat, cache, isLoading])

  useEffect(() => {
    // getting viewed file list
    axios.post(viewedHost(), { action: 'list', hash }).then(({ data }) => {
      if (data) {
        const lst = data.map(itm => itm.file_index).sort((a, b) => a - b)
        setViewedFileList(lst)
      } else setViewedFileList()
    })
  }, [hash])

  const bufferSize = settings?.PreloadBuffer ? Capacity : 33554432 // Default is 32mb if PreloadBuffer is false

  const getParsedTitle = () => {
    const newNameStrings = []

    const torrentParsedName = name && ptt.parse(name)

    if (title !== name) {
      newNameStrings.push(title)
    } else if (torrentParsedName?.title) newNameStrings.push(torrentParsedName?.title)

    // These 2 checks are needed to get year and resolution from torrent name if title does not have this info
    if (torrentParsedName?.year && !title.includes(torrentParsedName?.year))
      newNameStrings.push(torrentParsedName?.year)
    if (torrentParsedName?.resolution && !title.includes(torrentParsedName?.resolution))
      newNameStrings.push(torrentParsedName?.resolution)

    return newNameStrings.join('. ')
  }

  return (
    <>
      <DialogHeader
        onClose={closeDialog}
        title={isDetailedCacheView ? t('DetailedCacheView.header') : t('TorrentDetails')}
        {...(isDetailedCacheView && { onBack: () => setIsDetailedCacheView(false) })}
      />

      <div style={{ minHeight: '80vh', overflow: 'auto' }}>
        {isLoading ? (
          <Loader />
        ) : isDetailedCacheView ? (
          <DetailedView
            downloadSpeed={downloadSpeed}
            uploadSpeed={uploadSpeed}
            torrent={torrent}
            torrentSize={torrentSize}
            PiecesCount={PiecesCount}
            PiecesLength={PiecesLength}
            stat={stat}
            cache={cache}
          />
        ) : (
          <DialogContentGrid>
            <MainSection>
              <Poster poster={poster}>{poster ? <img alt='poster' src={poster} /> : <NoImageIcon />}</Poster>

              <div>
                {title && name !== title ? (
                  getParsedTitle().length > 90 ? (
                    <>
                      <SectionTitle>{ptt.parse(name).title}</SectionTitle>
                      <SectionSubName mb={20}>{getParsedTitle()}</SectionSubName>
                    </>
                  ) : (
                    <>
                      <SectionTitle>{getParsedTitle()}</SectionTitle>
                      <SectionSubName mb={20}>{ptt.parse(name).title}</SectionSubName>
                    </>
                  )
                ) : (
                  <SectionTitle mb={20}>{getParsedTitle()}</SectionTitle>
                )}

                <WidgetWrapper>
                  <DownlodSpeedWidget data={downloadSpeed} />
                  <UploadSpeedWidget data={uploadSpeed} />
                  <PeersWidget data={torrent} />
                  <SizeWidget data={torrentSize} />
                  <StatusWidget stat={stat} />
                </WidgetWrapper>

                <Divider />

                <TorrentFunctions
                  hash={hash}
                  viewedFileList={viewedFileList}
                  playableFileList={playableFileList}
                  name={name}
                  title={title}
                  setViewedFileList={setViewedFileList}
                />
              </div>
            </MainSection>

            <CacheSection>
              <SectionHeader>
                <SectionTitle mb={20}>{t('Buffer')}</SectionTitle>
                {!settings?.PreloadBuffer && <SectionSubName>{t('BufferNote')}</SectionSubName>}
                <LoadingProgress
                  value={Filled}
                  fullAmount={bufferSize}
                  label={`${humanizeSize(Filled) || '0 B'} / ${humanizeSize(bufferSize)}`}
                />
              </SectionHeader>

              <TorrentCache isMini cache={cache} />
              <Button
                style={{ marginTop: '30px' }}
                variant='contained'
                color='primary'
                size='large'
                onClick={() => setIsDetailedCacheView(true)}
              >
                {t('DetailedCacheView.button')}
              </Button>
            </CacheSection>

            <TorrentFilesSection>
              <SectionTitle mb={20}>{t('TorrentContent')}</SectionTitle>

              {seasonAmount?.length > 1 && (
                <>
                  <SectionSubName mb={7}>{t('SelectSeason')}</SectionSubName>
                  <ButtonGroup style={{ marginBottom: '30px' }} color='primary'>
                    {seasonAmount.map(season => (
                      <Button
                        key={season}
                        variant={selectedSeason === season ? 'contained' : 'outlined'}
                        onClick={() => setSelectedSeason(season)}
                      >
                        {season}
                      </Button>
                    ))}
                  </ButtonGroup>

                  <SectionTitle mb={20}>
                    {t('Season')} {selectedSeason}
                  </SectionTitle>
                </>
              )}

              <Table
                hash={hash}
                playableFileList={playableFileList}
                viewedFileList={viewedFileList}
                selectedSeason={selectedSeason}
                seasonAmount={seasonAmount}
              />
            </TorrentFilesSection>
          </DialogContentGrid>
        )}
      </div>
    </>
  )
}
