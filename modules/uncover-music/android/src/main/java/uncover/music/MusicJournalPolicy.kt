package uncover.music

/** Retain recent messages, never cap the model's number of steps within the current request. */
internal object MusicJournalPolicy {
  fun expiredRequests(history: List<Pair<String, Long>>, current: String): Set<String> {
    val byRequest = history.groupBy({ it.first }, { it.second }).mapValues { (_, times) -> times.maxOrNull() ?: 0 }
    val retained = byRequest.filterKeys { it != current }.entries.sortedByDescending { it.value }.take(31).map { it.key }.toSet() + current
    return byRequest.keys - retained
  }
}
