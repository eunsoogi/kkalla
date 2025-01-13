import { Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { User } from '../user/entities/user.entity';
import { CategoryService } from './category.service';
import { CategoryDto } from './dto/category.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { DeleteCategoryDto } from './dto/delete-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('/api/v1/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  public async findAll(@CurrentUser() user: User): Promise<CategoryDto[]> {
    const categories = await this.categoryService.findAllByUser(user);
    return categories.map((category) => ({
      id: category.id,
      category: category.category,
      enabled: category.enabled,
    }));
  }

  @Get('enabled')
  @UseGuards(GoogleTokenAuthGuard)
  public async findEnabled(@CurrentUser() user: User): Promise<CategoryDto[]> {
    const categories = await this.categoryService.findEnabledByUser(user);
    return categories.map((category) => ({
      id: category.id,
      category: category.category,
      enabled: category.enabled,
    }));
  }

  @Post()
  @UseGuards(GoogleTokenAuthGuard)
  public async create(@CurrentUser() user: User, @Body() createCategoryDto: CreateCategoryDto): Promise<CategoryDto> {
    const createdCategory = await this.categoryService.create(user, createCategoryDto.category);
    return {
      id: createdCategory.id,
      category: createdCategory.category,
      enabled: createdCategory.enabled,
    };
  }

  @Put()
  @UseGuards(GoogleTokenAuthGuard)
  public async update(@CurrentUser() user: User, @Body() updateCategoryDto: UpdateCategoryDto): Promise<CategoryDto> {
    const updatedCategory = await this.categoryService.update(
      user,
      updateCategoryDto.category,
      updateCategoryDto.enabled,
    );
    return {
      id: updatedCategory.id,
      category: updatedCategory.category,
      enabled: updatedCategory.enabled,
    };
  }

  @Delete()
  @UseGuards(GoogleTokenAuthGuard)
  public async remove(@CurrentUser() user: User, @Body() deleteCategoryDto: DeleteCategoryDto): Promise<void> {
    await this.categoryService.remove(user, deleteCategoryDto.category);
  }
}
