# Ticket branch request matrix

The caller supplies ticket identity and delivery authority. Adaptive delivery
owns branch selection; a separately mounted Git capability owns complete
inspection and exact preparation. Both native harnesses are in scope.

| Request                                                          | Expected behavior                           |
| ---------------------------------------------------------------- | ------------------------------------------- |
| Direct explicit delivery for issue-84 with a proposed new suffix | Discover and reuse the sole prior branch    |
| Preserved recipe delegation to deliver issue-84                  | Same correlation policy; recipe stays thin  |
| Explicit delivery with multiple correlated branches              | Ask for one exact choice before mutation    |
| Ordinary request to list ticket branches                         | Does not activate adaptive delivery         |
| Explicit delivery with zero matches and similar tokens           | Derive one conventional name and prepare it |
| Prior match beyond the first 50 branches                         | Complete capability evidence still finds it |

Mechanics are tested through the Git capability's public script. Colocated
native behavior cases verify that orchestration consumes that capability and
owns the decision without moving preparation into the recipe or preflight.
