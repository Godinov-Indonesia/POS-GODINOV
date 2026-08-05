package service

import (
	"context"
	"errors"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type productService struct {
	repo       domain.ProductRepository
	rmRepo     domain.RawMaterialRepository
	outletRepo domain.OutletRepository
	txManager  database.TransactionManager
}

func NewProductService(
	repo domain.ProductRepository,
	rmRepo domain.RawMaterialRepository,
	outletRepo domain.OutletRepository,
	txManager database.TransactionManager,
) domain.ProductService {
	return &productService{
		repo:       repo,
		rmRepo:     rmRepo,
		outletRepo: outletRepo,
		txManager:  txManager,
	}
}

func (s *productService) Create(ctx context.Context, businessID, outletID string, req *domain.CreateProductRequest) (*domain.Product, error) {
	if req.Name == "" || req.Price < 0 {
		return nil, errors.New("nama dan harga produk tidak valid")
	}

	// 1. Pastikan outlet valid dan milik bisnis
	outlet, err := s.outletRepo.GetByID(ctx, outletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak: outlet ini bukan milik bisnis Anda")
	}

	var createdProduct *domain.Product

	// 2. Gunakan Transaction Manager untuk insert Product beserta ProductRecipes (BOM)
	err = s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		// Validasi setiap raw material di resep
		var recipes []*domain.ProductRecipe
		seenMaterials := make(map[string]bool)

		for _, r := range req.Recipes {
			if r.Quantity <= 0 {
				return errors.New("kuantitas resep harus lebih dari 0")
			}
			if seenMaterials[r.RawMaterialID] {
				return errors.New("terdapat bahan baku ganda di dalam resep")
			}
			seenMaterials[r.RawMaterialID] = true

			// Pastikan raw material ini milik outlet yang sesuai
			rm, rmErr := s.rmRepo.GetByID(txCtx, r.RawMaterialID)
			if rmErr != nil || rm.OutletID != outletID {
				return errors.New("bahan baku tidak ditemukan atau tidak valid untuk outlet ini")
			}

			recipes = append(recipes, &domain.ProductRecipe{
				RawMaterialID: r.RawMaterialID,
				Quantity:      r.Quantity,
			})
		}

		product := &domain.Product{
			OutletID:   outletID,
			Name:       req.Name,
			Price:      req.Price,
			ImageURL:   req.ImageURL,
			CategoryID: req.CategoryID,
			Recipes:    recipes,
		}

		if err := s.repo.CreateProductWithRecipes(txCtx, product); err != nil {
			return errors.New("gagal menyimpan data produk dan resep")
		}

		createdProduct = product
		return nil
	})

	if err != nil {
		return nil, err
	}

	return createdProduct, nil
}

func (s *productService) CreateBulk(ctx context.Context, businessID, outletID string, reqs []*domain.CreateProductRequest) ([]*domain.Product, error) {
	outlet, err := s.outletRepo.GetByID(ctx, outletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak: outlet ini bukan milik bisnis Anda")
	}

	var createdProducts []*domain.Product

	err = s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		var products []*domain.Product

		// Pre-fetch all raw materials to avoid N+1 query
		rmIDs := make([]string, 0)
		rmIDMap := make(map[string]bool)
		for _, req := range reqs {
			for _, r := range req.Recipes {
				if !rmIDMap[r.RawMaterialID] {
					rmIDMap[r.RawMaterialID] = true
					rmIDs = append(rmIDs, r.RawMaterialID)
				}
			}
		}
		
		fetchedRMs, _ := s.rmRepo.GetByIDs(txCtx, rmIDs)

		for _, req := range reqs {
			if req.Name == "" || req.Price < 0 {
				return errors.New("nama dan harga produk tidak valid pada salah satu item")
			}

			var recipes []*domain.ProductRecipe
			seenMaterials := make(map[string]bool)

			for _, r := range req.Recipes {
				if r.Quantity <= 0 {
					return errors.New("kuantitas resep harus lebih dari 0")
				}
				if seenMaterials[r.RawMaterialID] {
					return errors.New("terdapat bahan baku ganda di dalam resep pada salah satu produk")
				}
				seenMaterials[r.RawMaterialID] = true

				rm, exists := fetchedRMs[r.RawMaterialID]
				if !exists || rm.OutletID != outletID {
					return errors.New("bahan baku tidak ditemukan atau tidak valid untuk outlet ini")
				}

				recipes = append(recipes, &domain.ProductRecipe{
					RawMaterialID: r.RawMaterialID,
					Quantity:      r.Quantity,
				})
			}

			products = append(products, &domain.Product{
				OutletID:   outletID,
				Name:       req.Name,
				Price:      req.Price,
				ImageURL:   req.ImageURL,
				CategoryID: req.CategoryID,
				Recipes:    recipes,
			})
		}

		if len(products) == 0 {
			return errors.New("data produk kosong")
		}

		if err := s.repo.CreateBulkProductsWithRecipes(txCtx, products); err != nil {
			return errors.New("gagal menyimpan data produk secara massal")
		}

		createdProducts = products
		return nil
	})

	if err != nil {
		return nil, err
	}

	return createdProducts, nil
}

func (s *productService) GetAllByOutlet(ctx context.Context, businessID, outletID string) ([]*domain.Product, error) {
	// Pastikan outlet valid dan milik bisnis
	outlet, err := s.outletRepo.GetByID(ctx, outletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak: outlet ini bukan milik bisnis Anda")
	}

	products, err := s.repo.GetAllByOutletID(ctx, outletID)
	if err != nil {
		return nil, errors.New("gagal mengambil data produk")
	}

	return products, nil
}

func (s *productService) Update(ctx context.Context, businessID, productID string, req *domain.UpdateProductRequest) (*domain.Product, error) {
	// Validasi input harga
	if req.Price < 0 {
		return nil, errors.New("harga produk tidak valid")
	}

	product, err := s.repo.GetByID(ctx, productID)
	if err != nil {
		return nil, errors.New("produk tidak ditemukan")
	}

	outlet, err := s.outletRepo.GetByID(ctx, product.OutletID)
	if err != nil {
		return nil, errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return nil, errors.New("akses ditolak: produk ini bukan milik bisnis Anda")
	}

	var updatedProduct *domain.Product

	err = s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		var recipes []*domain.ProductRecipe
		// Validasi setiap bahan baku (cek apakah bahan baku itu valid & milik outlet yang sama)
		for _, r := range req.Recipes {
			if r.Quantity <= 0 {
				return errors.New("kuantitas bahan baku pada resep tidak valid")
			}

			rm, errRm := s.rmRepo.GetByID(txCtx, r.RawMaterialID)
			if errRm != nil || rm.OutletID != product.OutletID {
				return errors.New("terdapat bahan baku yang tidak valid atau bukan milik outlet ini")
			}

			recipes = append(recipes, &domain.ProductRecipe{
				RawMaterialID: r.RawMaterialID,
				Quantity:      r.Quantity,
			})
		}

		if req.Name != "" {
			product.Name = req.Name
		}
		if req.Price >= 0 {
			product.Price = req.Price
		}
		if req.ImageURL != "" {
			product.ImageURL = req.ImageURL
		}
		product.CategoryID = req.CategoryID
		product.Recipes = recipes

		if err := s.repo.UpdateProductWithRecipes(txCtx, product); err != nil {
			return errors.New("gagal mengupdate produk dan resep")
		}

		updatedProduct = product
		return nil
	})

	if err != nil {
		return nil, err
	}

	return updatedProduct, nil
}

func (s *productService) Delete(ctx context.Context, businessID, productID string) error {
	product, err := s.repo.GetByID(ctx, productID)
	if err != nil {
		return errors.New("produk tidak ditemukan")
	}

	outlet, err := s.outletRepo.GetByID(ctx, product.OutletID)
	if err != nil {
		return errors.New("outlet tidak ditemukan")
	}
	if outlet.BusinessID != businessID {
		return errors.New("akses ditolak: produk ini bukan milik bisnis Anda")
	}

	if err := s.repo.DeleteProduct(ctx, productID); err != nil {
		return errors.New("gagal menghapus produk")
	}

	return nil
}
