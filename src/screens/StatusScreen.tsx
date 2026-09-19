import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ClusterStatusApi } from '@machafoundation/core';
import { useRefreshableAsync } from '../hooks/useAsync';
import { ErrorMessage, Loading, PageTitle, RefreshError } from '../components/Status';
import { colour, font, pageGutter, rem, type } from '../styles/theme';

/**
 * Cluster status, from the web client's `/status` section.
 *
 * **A reading, not a console.** That client has four routes here — cluster,
 * client, connectivity and a page per node — with actions on some of them. A
 * television is a poor place to administer anything, so this is the part a
 * viewer standing in front of the set can actually use: is the cluster healthy,
 * how many nodes are up, and which of them is which. The rest stays where a
 * keyboard is.
 *
 * Everything shown is core's `ClusterStatusApi`, unparsed and unsummarised by
 * this client: `health`, the node roll and each node's state are the server's
 * own words, and re-deriving any of them here would be a second opinion nobody
 * asked for.
 */
export function StatusScreen({ api }: { api: ClusterStatusApi }): React.JSX.Element {
  const snapshot = useRefreshableAsync(() => api.status(), [api]);

  if (!snapshot.value) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <PageTitle>Status</PageTitle>
        {snapshot.loading ? (
          <Loading />
        ) : snapshot.error ? (
          <ErrorMessage error={snapshot.error} />
        ) : null}
      </ScrollView>
    );
  }

  const { cluster, nodes } = snapshot.value;

  return (
    <ScrollView contentContainerStyle={styles.page} scrollEnabled={false}>
      <PageTitle>Status</PageTitle>
      {snapshot.error ? <RefreshError error={snapshot.error} /> : null}

      <View style={styles.section}>
        <Text style={styles.label}>Cluster</Text>
        <Row name="Health" value={cluster.health} emphasis={cluster.health !== 'healthy'} />
        <Row name="Nodes" value={`${cluster.nodes_online} of ${cluster.nodes_known} online`} />
        <Row
          name="Metadata"
          value={`${cluster.metadata_availability}, ${cluster.metadata_voters_online} of ${cluster.metadata_voters} voters, quorum ${cluster.metadata_quorum_required}`}
        />
        {/*
          Conditions are the server's own account of what is wrong. Rendered
          verbatim and only when present: an empty list is not "no problems
          reported", it is the absence of a report, and a cheerful line in its
          place would be this client inventing an answer.
        */}
        {cluster.conditions.length > 0
          ? cluster.conditions.map((condition) => (
              <Text key={condition} style={styles.condition}>
                {condition}
              </Text>
            ))
          : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Nodes</Text>
        {nodes.map((node) => (
          <View key={node.id} style={styles.node}>
            <Text style={styles.nodeName} numberOfLines={1}>
              {node.host}:{node.port}
            </Text>
            <Text style={[styles.nodeState, node.state !== 'online' && styles.nodeStateBad]}>
              {node.state}
              {node.phase ? ` · ${node.phase}` : ''}
            </Text>
            <Text style={styles.nodeMeta} numberOfLines={1}>
              {node.version} · telemetry {node.telemetry_freshness}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Row({
  name,
  value,
  emphasis,
}: {
  name: string;
  value: string;
  emphasis?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowName}>{name}</Text>
      <Text style={[styles.rowValue, emphasis && styles.rowValueEmphasis]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: rem(1),
    paddingBottom: rem(4),
  },
  section: {
    paddingHorizontal: pageGutter,
    marginBottom: rem(2.2),
  },
  label: {
    color: colour.textDim,
    marginTop: rem(1),
    marginBottom: rem(0.45),
    fontSize: type.body,
  },
  row: {
    flexDirection: 'row',
    gap: rem(0.8),
    marginBottom: rem(0.35),
  },
  rowName: {
    width: rem(9),
    color: colour.textFaint,
    fontSize: type.eyebrow,
    textTransform: 'uppercase',
    letterSpacing: type.eyebrow * 0.08,
    paddingTop: rem(0.15),
  },
  rowValue: {
    flex: 1,
    color: colour.text,
    fontSize: type.body,
  },
  rowValueEmphasis: {
    color: colour.error,
    fontWeight: font.weightMedium,
  },
  condition: {
    marginTop: rem(0.4),
    color: colour.error,
    fontSize: type.small,
  },
  node: {
    marginBottom: rem(0.8),
  },
  nodeName: {
    color: colour.text,
    fontSize: type.body,
  },
  nodeState: {
    color: colour.textDim,
    fontSize: type.small,
    textTransform: 'capitalize',
  },
  nodeStateBad: {
    color: colour.error,
  },
  nodeMeta: {
    color: colour.textFaint,
    fontSize: type.faint,
  },
});
