import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiChatDto } from './ai.dto';

/** Public endpoint (same as the other landing-page APIs): POST /api/ai/chat */
@Controller('api/ai')
export class AiController {
    constructor(private readonly ai: AiService) { }

    @Post('chat')
    async chat(@Body() dto: AiChatDto) {
        return this.ai.chat(dto.message, dto.session_id);
    }
}
