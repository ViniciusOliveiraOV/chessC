#ifndef CHESS_H
#define CHESS_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define BOARD_SQUARES 64
#define MOVE_BUFFER_SIZE 256

#pragma pack(push, 1)
typedef struct ChessMove {
    uint8_t from;
    uint8_t to;
    char captured;
} ChessMove;
#pragma pack(pop)

void chess_reset(void);
uint32_t chess_generate_moves(uint8_t is_white);
ChessMove *chess_get_moves(void);
uint32_t chess_random_ai(uint8_t is_white);
int32_t chess_apply_move(uint8_t from, uint8_t to);
uint8_t *chess_get_board(void);

#ifdef __cplusplus
}
#endif

#endif
